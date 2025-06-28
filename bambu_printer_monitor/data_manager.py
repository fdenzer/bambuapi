import json
from pathlib import Path
from typing import Optional, Dict, List
from bambu_printer_monitor.models import ApplicationState, UserSettings, PrinterInfo

CONFIG_FILE = Path("bambu_printer_monitor/config.json")
# In a real app, sensitive data like access tokens should be handled more securely.
# For this example, we're using a simple JSON file.

_app_state = ApplicationState()

def load_user_settings() -> UserSettings:
    """Loads user settings from the config file."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                data = json.load(f)

            # Backward compatibility for old config format
            if "user_settings" in data: # New format
                return UserSettings(**data["user_settings"])
            elif "access_token" in data: # Old flat format
                 return UserSettings(access_token=data.get("access_token"), account_email=data.get("account_email"))
            else: # Empty or unknown format
                print("Warning: config.json is empty or in an unknown format. Using default UserSettings.")
                return UserSettings()
        except json.JSONDecodeError:
            print(f"Error: Could not decode {CONFIG_FILE}. Please ensure it's valid JSON.")
            return UserSettings() # Return default if file is corrupt
        except Exception as e:
            print(f"Error loading config: {e}. Using default UserSettings.")
            return UserSettings()
    return UserSettings()

def save_user_settings(settings: UserSettings):
    """Saves user settings to the config file."""
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    # Structure it with a "user_settings" key to match the example
    with open(CONFIG_FILE, "w") as f:
        json.dump({"user_settings": settings.dict()}, f, indent=2)

def get_app_state() -> ApplicationState:
    """Returns the global application state."""
    global _app_state
    if not _app_state.user_settings.access_token: # Load settings if not already loaded
        _app_state.user_settings = load_user_settings()
    return _app_state

def update_printers_in_state(printers_data: List[PrinterInfo]):
    """Updates the printers list in the global application state."""
    global _app_state
    _app_state.printers = printers_data
    # Optionally, here you could implement merging logic if you want to preserve
    # printers that might temporarily disappear from an API response.
    # For now, we'll just replace the list.

def update_last_successful_fetch_timestamp(timestamp: float):
    global _app_state
    _app_state.last_successful_fetch_timestamp = timestamp

def update_last_error_message(message: Optional[str]):
    global _app_state
    _app_state.last_error_message = message

def set_fetching_status(is_fetching: bool):
    global _app_state
    _app_state.is_fetching = is_fetching

if __name__ == '__main__':
    # Example usage:
    settings = load_user_settings()
    print(f"Loaded settings: {settings}")

    if not settings.access_token:
        print("Access token not found. Please create/update bambu_printer_monitor/config.json")
        new_token = input("Enter new access token (or leave blank to skip): ").strip()
        if new_token:
            settings.access_token = new_token
            save_user_settings(settings)
            print("New access token saved.")

    current_app_state = get_app_state()
    print(f"Current app state (printers): {current_app_state.printers}")
    # Example of updating (normally done by the API client part)
    # from datetime import datetime
    # mock_printer = PrinterInfo(dev_id="test1", name="Test Printer", model_name="X1", product_name="X1C", is_online=True, last_updated_timestamp=datetime.utcnow().timestamp())
    # update_printers_in_state([mock_printer])
    # print(f"Updated app state (printers): {current_app_state.printers}")
