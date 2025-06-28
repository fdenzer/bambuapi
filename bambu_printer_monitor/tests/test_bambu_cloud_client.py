import unittest
import asyncio
from unittest.mock import patch, AsyncMock, MagicMock

from bambu_printer_monitor.models import UserSettings, PrinterInfo, DeviceFromApi, PrintApiResponse
from bambu_printer_monitor.bambu_cloud_client import BambuCloudClient, BAMBU_API_BASE_URL

class TestBambuCloudClient(unittest.TestCase):

    def setUp(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        self.user_settings = UserSettings(access_token="fake_token")
        self.client = BambuCloudClient(user_settings=self.user_settings)

    def tearDown(self):
        self.loop.run_until_complete(self.client.close_session()) # Close httpx client session
        self.loop.close()

    @patch('bambu_printer_monitor.bambu_cloud_client.httpx.AsyncClient')
    def test_get_all_printers_status_success(self, MockAsyncClient):
        """Test successful fetching of printer statuses."""
        mock_response = AsyncMock()
        mock_response.status_code = 200

        # Correctly structure the mock JSON response based on PrintApiResponse and DeviceFromApi
        api_device_data = {
            "dev_id": "device_123",
            "name": "My Printer", # Corresponds to dev_name in DeviceFromApi via alias
            "model_name": "X1C", # Corresponds to dev_model_name
            "product_name": "Bambu Lab X1 Carbon", # Corresponds to dev_product_name
            "online": True, # Corresponds to dev_online
            "access_code": "123456", # Corresponds to dev_access_code
            "task_id": "task_789",
            "task_name": "Benchy",
            "task_status": "RUNNING",
            "start_time": 1678886400.0, # Example timestamp
            "prediction": 3600, # Example remaining time in seconds
            "progress": 50.0, # Example progress
            "thumbnail": "http://example.com/thumb.png"
        }
        mock_api_response_data = {
            "message": "success",
            "code": None,
            "error": None,
            "devices": [api_device_data]
        }
        # mock_response.json.return_value = mock_api_response_data # Old way
        mock_response.json = MagicMock(return_value=mock_api_response_data) # Correct way

        # Configure the mock AsyncClient instance's request method
        mock_http_client_instance = MockAsyncClient.return_value
        mock_http_client_instance.request = AsyncMock(return_value=mock_response)

        # Re-initialize client to use the mocked AsyncClient
        client_with_mock = BambuCloudClient(user_settings=self.user_settings)
        client_with_mock.http_client = mock_http_client_instance # Directly assign the mocked client instance

        printers, error = self.loop.run_until_complete(client_with_mock.get_all_printers_status())

        self.assertIsNone(error, msg=f"Expected no error, but got: {error}")
        self.assertIsNotNone(printers)
        self.assertEqual(len(printers), 1)

        printer: PrinterInfo = printers[0]
        self.assertEqual(printer.dev_id, "device_123")
        self.assertEqual(printer.name, "My Printer")
        self.assertEqual(printer.model_name, "X1C")
        self.assertEqual(printer.product_name, "Bambu Lab X1 Carbon")
        self.assertTrue(printer.is_online)
        self.assertEqual(printer.access_code, "123456")
        self.assertEqual(printer.task_id, "task_789")
        self.assertEqual(printer.task_name, "Benchy")
        self.assertEqual(printer.task_status, "RUNNING")
        self.assertEqual(printer.start_time_timestamp, 1678886400.0)
        self.assertEqual(printer.remaining_time_seconds, 3600)
        self.assertEqual(printer.progress_percentage, 50.0)
        self.assertEqual(printer.thumbnail_url, "http://example.com/thumb.png")

        expected_url = f"{BAMBU_API_BASE_URL}/v1/iot-service/api/user/print"
        mock_http_client_instance.request.assert_called_once_with(
            "GET", expected_url,
            headers={"Authorization": "Bearer fake_token", "User-Agent": "BambuPrinterMonitor/0.1"},
            params={"force": "true"},
            json=None
        )

    @patch('bambu_printer_monitor.bambu_cloud_client.httpx.AsyncClient')
    def test_get_all_printers_status_api_error_message(self, MockAsyncClient):
        """Test API returning a 200 OK but with an error message in the body."""
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_api_response_data = {
            "message": "failed",
            "code": 123,
            "error": "Some API Error",
            "devices": []
        }
        # mock_response.json.return_value = mock_api_response_data # Old way
        mock_response.json = MagicMock(return_value=mock_api_response_data) # Correct way

        mock_http_client_instance = MockAsyncClient.return_value
        mock_http_client_instance.request = AsyncMock(return_value=mock_response)

        client_with_mock = BambuCloudClient(user_settings=self.user_settings)
        client_with_mock.http_client = mock_http_client_instance

        printers, error = self.loop.run_until_complete(client_with_mock.get_all_printers_status())

        self.assertIsNone(printers)
        self.assertIsNotNone(error)
        self.assertIn("API indicated non-success: failed Some API Error", error)


    @patch('bambu_printer_monitor.bambu_cloud_client.httpx.AsyncClient')
    def test_get_all_printers_status_http_error(self, MockAsyncClient):
        """Test handling of HTTP errors (e.g., 401 Unauthorized)."""
        mock_response = AsyncMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized token"

        # Mock raise_for_status to raise the specific exception
        from httpx import HTTPStatusError, Request, Response
        http_error = HTTPStatusError(
            message="Client error '401 Unauthorized' for url 'https://api.bambulab.com/...' ",
            request=Request(method="GET", url=f"{BAMBU_API_BASE_URL}/v1/iot-service/api/user/print"),
            response=Response(status_code=401, text="Unauthorized token")
        )

        mock_http_client_instance = MockAsyncClient.return_value

        # Configure .request to return the mock_response
        # The actual raise_for_status logic is tested by its side_effect
        mock_http_client_instance.request = AsyncMock(return_value=mock_response)

        # httpx.Response.raise_for_status() is synchronous.
        mock_response.raise_for_status = MagicMock(side_effect=http_error)

        client_with_mock = BambuCloudClient(user_settings=self.user_settings)
        client_with_mock.http_client = mock_http_client_instance

        printers, error = self.loop.run_until_complete(client_with_mock.get_all_printers_status())

        self.assertIsNone(printers)
        self.assertIsNotNone(error)
        self.assertIn("HTTP error: 401 - Unauthorized token", error)
        self.assertIn("(Unauthorized - check your access token)", error)

    @patch('bambu_printer_monitor.bambu_cloud_client.httpx.AsyncClient')
    def test_get_all_printers_status_request_error(self, MockAsyncClient):
        """Test handling of generic request errors (e.g., network issue)."""
        from httpx import RequestError

        mock_http_client_instance = MockAsyncClient.return_value
        mock_http_client_instance.request = AsyncMock(side_effect=RequestError("Network failed"))

        client_with_mock = BambuCloudClient(user_settings=self.user_settings)
        client_with_mock.http_client = mock_http_client_instance

        printers, error = self.loop.run_until_complete(client_with_mock.get_all_printers_status())

        self.assertIsNone(printers)
        self.assertIsNotNone(error)
        self.assertEqual(error, "Request error: Network failed")

    def test_no_access_token(self):
        """Test behavior when no access token is configured."""
        client_no_token = BambuCloudClient(user_settings=UserSettings(access_token=None))
        printers, error = self.loop.run_until_complete(client_no_token.get_all_printers_status())

        self.assertIsNone(printers)
        self.assertIsNotNone(error)
        self.assertEqual(error, "Access token not configured.")

    @patch('bambu_printer_monitor.bambu_cloud_client.httpx.AsyncClient')
    def test_get_all_printers_status_parsing_error(self, MockAsyncClient):
        """Test handling of errors during response parsing (e.g., unexpected format)."""
        mock_response = AsyncMock()
        mock_response.status_code = 200
        # Malformed data that will fail Pydantic validation for PrintApiResponse
        malformed_api_response_data = {
            "message": "success",
            "devices": [{"not_a_valid_device_field": "some_value"}]
        }
        # mock_response.json.return_value = malformed_api_response_data # Old way
        mock_response.json = MagicMock(return_value=malformed_api_response_data) # Correct way

        mock_http_client_instance = MockAsyncClient.return_value
        mock_http_client_instance.request = AsyncMock(return_value=mock_response)

        client_with_mock = BambuCloudClient(user_settings=self.user_settings)
        client_with_mock.http_client = mock_http_client_instance

        printers, error = self.loop.run_until_complete(client_with_mock.get_all_printers_status())

        self.assertIsNone(printers)
        self.assertIsNotNone(error)
        self.assertTrue(error.startswith("Error parsing printer data:"))
        self.assertIn("field required", error.lower()) # Pydantic validation error message part

if __name__ == '__main__':
    unittest.main()
