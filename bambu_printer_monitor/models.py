from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

class UserSettings(BaseModel):
    access_token: Optional[str] = None
    account_email: Optional[str] = None
    # token_expiry_timestamp: Optional[datetime] = None # Not used for now

class PrinterInfo(BaseModel):
    dev_id: str
    name: str
    model_name: str
    product_name: str
    is_online: bool
    access_code: Optional[str] = None # From API, but might not be directly used for cloud polling

    task_id: Optional[str] = None
    task_name: Optional[str] = None
    task_status: Optional[str] = None # e.g., "RUNNING", "SUCCESS", "FAILED", "INIT"

    start_time_timestamp: Optional[float] = Field(None, alias="start_time") # API provides epoch timestamp
    remaining_time_seconds: Optional[int] = Field(None, alias="prediction")
    progress_percentage: Optional[float] = Field(None, alias="progress") # API uses "mc_percent" or "gcode_file_prepare_percent"

    thumbnail_url: Optional[str] = Field(None, alias="thumbnail")

    # Fields to be populated/managed locally by our app
    last_updated_timestamp: float = Field(default_factory=lambda: datetime.utcnow().timestamp())

    # This is to handle the device list from /api/user/print
class DeviceFromApi(BaseModel):
    dev_id: str
    dev_name: str = Field(alias="name")
    dev_model_name: str = Field(alias="model_name")
    dev_product_name: str = Field(alias="product_name")
    dev_online: bool = Field(alias="online")
    dev_access_code: Optional[str] = Field(None, alias="access_code")

    task_id: Optional[str] = None
    task_name: Optional[str] = None # Might need to confirm actual field name from live API for task name
    task_status: Optional[str] = None # This is often part of a different structure in Bambu's MQTT/API, might need adjustment

    # Direct fields from /api/user/print device entry if available
    # The API doc for /api/user/print shows these fields directly in the device object
    start_time: Optional[float] = None # Assuming epoch timestamp
    prediction: Optional[int] = None # In seconds
    progress: Optional[float] = None # As percentage
    thumbnail: Optional[str] = None

    # Fields from the /v1/iot-service/api/user/bind endpoint (if we choose to use it)
    # print_status: Optional[str] = None # from /bind, might differ from task_status

class PrintApiResponse(BaseModel):
    message: str
    code: Optional[int] = None
    error: Optional[str] = None
    devices: List[DeviceFromApi] = []

class BindApiResponseDevice(BaseModel):
    dev_id: str
    name: str
    online: bool
    print_status: str
    dev_model_name: str
    dev_product_name: str
    dev_access_code: str

class BindApiResponse(BaseModel):
    message: str
    code: Optional[int] = None
    error: Optional[str] = None
    devices: List[BindApiResponseDevice] = []


# Application state, not for direct API response but for internal use
class ApplicationState(BaseModel):
    printers: List[PrinterInfo] = []
    user_settings: UserSettings = UserSettings()
    last_successful_fetch_timestamp: Optional[float] = None
    last_error_message: Optional[str] = None
    is_fetching: bool = False # To prevent concurrent fetches by the scheduler

    class Config:
        arbitrary_types_allowed = True
