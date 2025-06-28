import httpx # Using httpx for async requests, can be swapped with requests if sync is preferred
from typing import List, Optional, Tuple
from datetime import datetime
from bambu_printer_monitor.models import PrinterInfo, DeviceFromApi, PrintApiResponse, UserSettings

BAMBU_API_BASE_URL = "https://api.bambulab.com"

class BambuCloudClient:
    def __init__(self, user_settings: UserSettings):
        self.user_settings = user_settings
        self.http_client = httpx.AsyncClient(timeout=20.0) # Increased timeout

    async def _request(self, method: str, endpoint: str, params: Optional[dict] = None, json_data: Optional[dict] = None) -> Tuple[Optional[dict], Optional[str]]:
        """Helper function to make requests to the Bambu API."""
        if not self.user_settings.access_token:
            return None, "Access token not configured."

        headers = {
            "Authorization": f"Bearer {self.user_settings.access_token}",
            "User-Agent": "BambuPrinterMonitor/0.1" # Good practice to set a User-Agent
        }
        url = f"{BAMBU_API_BASE_URL}{endpoint}"

        try:
            response = await self.http_client.request(method, url, headers=headers, params=params, json=json_data)
            response.raise_for_status()  # Raises HTTPStatusError for 4xx/5xx responses
            return response.json(), None
        except httpx.HTTPStatusError as e:
            error_detail = f"HTTP error: {e.response.status_code} - {e.response.text}"
            if e.response.status_code == 401:
                error_detail += " (Unauthorized - check your access token)"
            elif e.response.status_code == 403:
                 error_detail += " (Forbidden - check API permissions or token scope)"
            return None, error_detail
        except httpx.RequestError as e:
            return None, f"Request error: {e}"
        except Exception as e: # Catch any other unexpected errors
            return None, f"An unexpected error occurred: {e}"

    async def get_all_printers_status(self) -> Tuple[Optional[List[PrinterInfo]], Optional[str]]:
        """
        Fetches the status of all printers linked to the account.
        Uses GET /v1/iot-service/api/user/print?force=true
        """
        endpoint = "/v1/iot-service/api/user/print"
        params = {"force": "true"} # As recommended by API docs

        response_data, error = await self._request("GET", endpoint, params=params)

        if error:
            return None, error
        if not response_data: # Should not happen if no error, but good practice
            return None, "No data received from API"

        try:
            api_response = PrintApiResponse(**response_data)
            if api_response.message.lower() != "success":
                # Sometimes the API returns 200 OK but message indicates an issue
                return None, f"API indicated non-success: {api_response.message} {api_response.error or ''}"

            printers_info_list: List[PrinterInfo] = []
            now_ts = datetime.utcnow().timestamp()
            for device_data in api_response.devices:
                # Map DeviceFromApi to PrinterInfo
                # The DeviceFromApi model uses aliases to match the API fields directly
                # We need to ensure all fields are correctly mapped or handled if None

                # The API gives start_time as epoch, prediction in seconds.
                # progress is usually mc_percent or gcode_file_prepare_percent.
                # The `DeviceFromApi` model uses aliases to map these.

                printer_info = PrinterInfo(
                    dev_id=device_data.dev_id,
                    name=device_data.dev_name,
                    model_name=device_data.dev_model_name,
                    product_name=device_data.dev_product_name,
                    is_online=device_data.dev_online,
                    access_code=device_data.dev_access_code,
                    task_id=device_data.task_id,
                    task_name=device_data.task_name, # Ensure this field name is correct from actual API response if issues arise
                    task_status=device_data.task_status,
                    # Use the alias 'start_time' for PrinterInfo model, Pydantic will map it to start_time_timestamp
                    start_time=device_data.start_time,
                    # Use aliases for other fields as defined in PrinterInfo model
                    prediction=device_data.prediction, # Will map to remaining_time_seconds
                    progress=device_data.progress,     # Will map to progress_percentage
                    thumbnail=device_data.thumbnail,   # Will map to thumbnail_url
                    last_updated_timestamp=now_ts
                )
                printers_info_list.append(printer_info)

            return printers_info_list, None
        except Exception as e: # Catch Pydantic validation errors or other parsing issues
            return None, f"Error parsing printer data: {e}. Response: {response_data}"

    async def close_session(self):
        await self.http_client.aclose()

# Example Usage (for testing this module directly)
if __name__ == "__main__":
    import asyncio
    from bambu_printer_monitor.data_manager import load_user_settings

    async def main():
        settings = load_user_settings()
        if not settings.access_token:
            print("Access token not found in config.json. Please add it to test.")
            return

        client = BambuCloudClient(user_settings=settings)
        print("Fetching printer statuses...")
        printers, error = await client.get_all_printers_status()

        if error:
            print(f"Error fetching printers: {error}")
        elif printers is not None:
            if printers:
                print(f"Successfully fetched {len(printers)} printers:")
                for p in printers:
                    print(f"  ID: {p.dev_id}, Name: {p.name}, Online: {p.is_online}, Status: {p.task_status}, Progress: {p.progress_percentage}%")
            else:
                print("No printers found for this account or API returned empty list.")
        else:
            print("No printers returned and no specific error message.")

        await client.close_session()

    asyncio.run(main())
