import unittest
import json
from pathlib import Path
from unittest.mock import patch, mock_open

from bambu_printer_monitor.models import UserSettings, ApplicationState, PrinterInfo
from bambu_printer_monitor import data_manager # So we can reset its internal state

class TestDataManager(unittest.TestCase):

    def setUp(self):
        # Reset the global state in data_manager before each test
        data_manager._app_state = ApplicationState()
        # Ensure a clean config file state for each test
        self.config_file_patch = patch('bambu_printer_monitor.data_manager.CONFIG_FILE', Path("bambu_printer_monitor/tests/test_config.json"))
        self.mock_config_path = self.config_file_patch.start()
        self.addCleanup(self.config_file_patch.stop)

        # Clean up any test_config.json that might exist
        if self.mock_config_path.exists():
            self.mock_config_path.unlink()

    def tearDown(self):
        # Clean up test_config.json after each test
        if self.mock_config_path.exists():
            self.mock_config_path.unlink()

    def test_load_user_settings_no_file(self):
        """Test loading settings when config file doesn't exist."""
        settings = data_manager.load_user_settings()
        self.assertIsInstance(settings, UserSettings)
        self.assertIsNone(settings.access_token)
        self.assertIsNone(settings.account_email)

    def test_load_user_settings_empty_file(self):
        """Test loading settings from an empty JSON file."""
        with open(self.mock_config_path, 'w') as f:
            json.dump({}, f)
        settings = data_manager.load_user_settings()
        self.assertIsInstance(settings, UserSettings)
        self.assertIsNone(settings.access_token)

    def test_load_user_settings_corrupt_file(self):
        """Test loading settings from a corrupt JSON file."""
        with open(self.mock_config_path, 'w') as f:
            f.write("not json")

        with patch('builtins.print') as mock_print: # Suppress print warnings
            settings = data_manager.load_user_settings()
        self.assertIsInstance(settings, UserSettings)
        self.assertIsNone(settings.access_token)
        mock_print.assert_any_call(f"Error: Could not decode {self.mock_config_path}. Please ensure it's valid JSON.")


    def test_load_user_settings_new_format(self):
        """Test loading settings with the new nested 'user_settings' key."""
        config_data = {"user_settings": {"access_token": "test_token_new", "account_email": "new@example.com"}}
        with open(self.mock_config_path, 'w') as f:
            json.dump(config_data, f)

        settings = data_manager.load_user_settings()
        self.assertEqual(settings.access_token, "test_token_new")
        self.assertEqual(settings.account_email, "new@example.com")

    def test_load_user_settings_old_format(self):
        """Test loading settings with the old flat format for backward compatibility."""
        config_data = {"access_token": "test_token_old", "account_email": "old@example.com"}
        with open(self.mock_config_path, 'w') as f:
            json.dump(config_data, f)

        settings = data_manager.load_user_settings()
        self.assertEqual(settings.access_token, "test_token_old")
        self.assertEqual(settings.account_email, "old@example.com")


    def test_save_and_load_user_settings(self):
        """Test saving and then loading user settings."""
        settings_to_save = UserSettings(access_token="save_test_token", account_email="save@example.com")
        data_manager.save_user_settings(settings_to_save)

        loaded_settings = data_manager.load_user_settings()
        self.assertEqual(loaded_settings.access_token, "save_test_token")
        self.assertEqual(loaded_settings.account_email, "save@example.com")

        # Verify it's saved in the new format
        with open(self.mock_config_path, 'r') as f:
            raw_data = json.load(f)
        self.assertIn("user_settings", raw_data)
        self.assertEqual(raw_data["user_settings"]["access_token"], "save_test_token")


    def test_get_app_state_loads_settings_initially(self):
        """Test that get_app_state loads UserSettings if not already loaded."""
        config_data = {"user_settings": {"access_token": "initial_token"}}
        with open(self.mock_config_path, 'w') as f:
            json.dump(config_data, f)

        # Ensure _app_state.user_settings is None or default initially
        data_manager._app_state = ApplicationState()
        self.assertIsNone(data_manager._app_state.user_settings.access_token)

        app_state = data_manager.get_app_state()
        self.assertEqual(app_state.user_settings.access_token, "initial_token")

    def test_update_printers_in_state(self):
        """Test updating the printers list in the application state."""
        app_state = data_manager.get_app_state()
        self.assertEqual(len(app_state.printers), 0)

        mock_printer = PrinterInfo(dev_id="p1", name="P1", model_name="M1", product_name="PN1", is_online=True)
        printers_data = [mock_printer]
        data_manager.update_printers_in_state(printers_data)

        self.assertEqual(len(app_state.printers), 1)
        self.assertEqual(app_state.printers[0].dev_id, "p1")

    def test_update_timestamps_and_errors(self):
        """Test updating fetch timestamps and error messages."""
        app_state = data_manager.get_app_state()

        self.assertIsNone(app_state.last_successful_fetch_timestamp)
        data_manager.update_last_successful_fetch_timestamp(12345.6789)
        self.assertEqual(app_state.last_successful_fetch_timestamp, 12345.6789)

        self.assertIsNone(app_state.last_error_message)
        data_manager.update_last_error_message("Test Error")
        self.assertEqual(app_state.last_error_message, "Test Error")
        data_manager.update_last_error_message(None) # Clear error
        self.assertIsNone(app_state.last_error_message)

    def test_set_fetching_status(self):
        app_state = data_manager.get_app_state()
        self.assertFalse(app_state.is_fetching)
        data_manager.set_fetching_status(True)
        self.assertTrue(app_state.is_fetching)
        data_manager.set_fetching_status(False)
        self.assertFalse(app_state.is_fetching)

if __name__ == '__main__':
    unittest.main()
