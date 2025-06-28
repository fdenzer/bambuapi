import asyncio
from flask import Flask, jsonify, render_template_string # render_template_string for simple frontend
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timezone
import logging

from bambu_printer_monitor.models import ApplicationState, UserSettings
from bambu_printer_monitor.data_manager import get_app_state, update_printers_in_state, \
                                                update_last_successful_fetch_timestamp, \
                                                update_last_error_message, set_fetching_status, \
                                                save_user_settings, load_user_settings
from bambu_printer_monitor.bambu_cloud_client import BambuCloudClient

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
scheduler = AsyncIOScheduler(timezone="UTC") # Explicitly set timezone

# --- Global State and Client ---
_bambu_client: BambuCloudClient = None
_scheduler_initialized = False # Moved here for clarity, as it's used by on_startup

async def initialize_client_and_app_state():
    global _bambu_client
    app_state = get_app_state()

    if not app_state.user_settings.access_token:
        logger.warning("Bambu Lab access token not found in config.json. API calls will fail.")

    _bambu_client = BambuCloudClient(user_settings=app_state.user_settings)
    logger.info("BambuCloudClient initialized.")

async def fetch_printer_data_job():
    app_state = get_app_state()
    if app_state.is_fetching:
        logger.info("Previous fetch job still running. Skipping this interval.")
        return

    if not _bambu_client or not _bambu_client.user_settings.access_token:
        logger.error("Cannot fetch printer data: Bambu client not initialized or access token missing.")
        update_last_error_message("Client not initialized or access token missing.")
        return

    logger.info("Starting scheduled printer data fetch...")
    set_fetching_status(True)
    try:
        printers, error = await _bambu_client.get_all_printers_status()
        if error:
            logger.error(f"Error fetching printer data: {error}")
            update_last_error_message(error)
        elif printers is not None:
            update_printers_in_state(printers)
            update_last_successful_fetch_timestamp(datetime.now(timezone.utc).timestamp())
            update_last_error_message(None)
            logger.info(f"Successfully fetched data for {len(printers)} printers.")
        else:
            update_printers_in_state([])
            update_last_error_message("API returned no data and no specific error.")
            logger.info("Fetched data but no printers found or API returned empty list.")
    except Exception as e:
        logger.exception("Unhandled exception in fetch_printer_data_job:")
        update_last_error_message(f"Unhandled exception: {str(e)}")
    finally:
        set_fetching_status(False)

@app.route('/')
def index():
    app_state = get_app_state()
    printers_html_parts = []
    if not app_state.printers and not app_state.last_error_message and not app_state.user_settings.access_token:
        printers_html_parts.append("<p>Access token not configured. Please set it in <code>bambu_printer_monitor/config.json</code>.</p>")
    elif not app_state.printers and not app_state.last_error_message and app_state.user_settings.access_token and not app_state.last_successful_fetch_timestamp:
         printers_html_parts.append("<p>Waiting for first data fetch... Refresh in a minute.</p>")
    elif app_state.printers:
        for printer in app_state.printers:
            status_color = "green" if printer.is_online else "red"
            start_time_str = datetime.fromtimestamp(printer.start_time_timestamp, timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC') if printer.start_time_timestamp else "N/A"
            remaining_time_str = f"{printer.remaining_time_seconds // 3600}h {(printer.remaining_time_seconds % 3600) // 60}m" if printer.remaining_time_seconds is not None else "N/A"
            printers_html_parts.append(f"""
            <div style="border: 1px solid #ccc; margin-bottom: 10px; padding: 10px;">
                <h3>{printer.name} ({printer.product_name} - {printer.dev_id})</h3>
                <p>Status: <strong style="color:{status_color};">{ 'Online' if printer.is_online else 'Offline' }</strong></p>
                <p>Print Job: {printer.task_name or 'Idle'}</p>
                <p>Job Status: {printer.task_status or 'N/A'}</p>
                <p>Progress: {printer.progress_percentage if printer.progress_percentage is not None else 'N/A'}%</p>
                <p>Started: {start_time_str}</p>
                <p>Remaining: {remaining_time_str}</p>
                <p><small>Last updated: {datetime.fromtimestamp(printer.last_updated_timestamp, timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}</small></p>
                {f'<img src="{printer.thumbnail_url}" alt="Thumbnail" width="200">' if printer.thumbnail_url else ''}
            </div>""")
    else:
        printers_html_parts.append("<p>No printer data available yet. Waiting for scheduled fetch or check logs for errors.</p>")
    last_fetch_str = datetime.fromtimestamp(app_state.last_successful_fetch_timestamp, timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC') if app_state.last_successful_fetch_timestamp else "Never"
    html_content = f"""
    <html><head><title>Bambu Printer Monitor</title><meta http-equiv="refresh" content="60"></head>
    <body><h1>Bambu Lab Printer Status</h1><p><em>Page auto-refreshes every 60 seconds.</em></p>
    <p>Last successful data fetch: {last_fetch_str}</p>
    {f'<p style="color:red;">Last Error: {app_state.last_error_message}</p>' if app_state.last_error_message else ''}
    <hr>{''.join(printers_html_parts)}</body></html>"""
    return render_template_string(html_content)

@app.route('/api/status', methods=['GET'])
def api_status():
    app_state = get_app_state()
    return jsonify(app_state.dict(exclude={'user_settings': {'access_token'}}))

@app.route('/api/force_refresh', methods=['POST'])
def force_refresh():
    logger.info("Force refresh triggered via API.")
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(fetch_printer_data_job())
        else:
            asyncio.run(fetch_printer_data_job())
    except RuntimeError:
        asyncio.run(fetch_printer_data_job())
    return jsonify({"message": "Data refresh triggered. Check /api/status for updates soon."}), 202

async def on_startup():
    global _scheduler_initialized, _bambu_client
    if not _scheduler_initialized:
        logger.info("Application starting up...")
        await initialize_client_and_app_state()

        if get_app_state().user_settings.access_token:
            logger.info("Performing initial data fetch on app startup...")
            if app.config.get('TESTING'):
                await fetch_printer_data_job()
            else:
                asyncio.create_task(fetch_printer_data_job())
        else:
            logger.warning("No access_token. Initial data fetch skipped.")

        if not scheduler.running and not app.config.get('TESTING'):
            scheduler.add_job(fetch_printer_data_job, IntervalTrigger(seconds=60), id="fetch_data_job", misfire_grace_time=30)
            scheduler.start()
            logger.info("Scheduler started.")
        elif app.config.get('TESTING'):
            logger.info("App is in TESTING mode, scheduler not started automatically by on_startup.")
            if not scheduler.get_job("fetch_data_job"):
                 scheduler.add_job(fetch_printer_data_job, IntervalTrigger(seconds=60), id="fetch_data_job", misfire_grace_time=30, next_run_time=None)
        _scheduler_initialized = True

async def on_shutdown():
    logger.info("Application shutting down...")
    if scheduler.running and not app.config.get('TESTING'):
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down.")
    elif app.config.get('TESTING') and scheduler.running:
        scheduler.remove_all_jobs()
        logger.info("App is in TESTING mode, scheduler jobs removed.")

    global _bambu_client # Ensure we are referencing the global client
    if _bambu_client: # Check if it was initialized
        logger.info("Closing Bambu Cloud Client session...")
        await _bambu_client.close_session()
        _bambu_client = None # Clear it after closing
    logger.info("Cleanup complete.")

# Conditional registration of before_request hook based on TESTING flag
if not app.config.get('TESTING'):
    @app.before_request
    async def ensure_services_started():
        global _scheduler_initialized
        if not _scheduler_initialized:
            logger.info("Attempting to initialize services (scheduler, client) via before_request...")
            await on_startup() # Call the main on_startup logic
else:
    logger.info("App is in TESTING mode, @app.before_request hook 'ensure_services_started' is disabled.")

@app.teardown_appcontext
def sync_shutdown_appcontext(exception=None):
    pass # Main cleanup via atexit or ASGI on_shutdown

import atexit
def cleanup_resources():
    # This is a sync function. For async cleanup, it needs to manage its own loop if necessary.
    logger.info("atexit: Application shutting down. Cleaning up resources...")
    # Handle scheduler shutdown if it's running (primarily for non-ASGI, non-testing scenarios)
    if scheduler.running:
        scheduler.shutdown(wait=True)
        logger.info("atexit: Scheduler shut down.")

    # For _bambu_client, which needs an async close:
    # If an event loop is running, try to schedule _async_cleanup.
    # Otherwise, run it in a new loop. This is tricky with atexit.
    # The on_shutdown (called by ASGI) is a better place for async cleanup.
    # For simple script termination where on_shutdown might not be called, this is a best effort.
    if _bambu_client:
        try:
            loop = asyncio.get_event_loop_policy().get_event_loop()
            if loop.is_running():
                # This is problematic as atexit handlers shouldn't usually schedule new tasks on a running loop
                # that might be closing.
                # For simplicity, we'll rely on on_shutdown for proper async cleanup.
                logger.warning("atexit: _bambu_client might not be cleanly closed if event loop is still running here.")
            else:
                asyncio.run(_async_cleanup_for_atexit())
        except RuntimeError: # No current event loop
            asyncio.run(_async_cleanup_for_atexit())
        logger.info("atexit: _async_cleanup process attempted.")

async def _async_cleanup_for_atexit(): # Separate helper for atexit
    global _bambu_client
    if _bambu_client:
        logger.info("atexit: Closing Bambu Cloud Client session via _async_cleanup_for_atexit...")
        await _bambu_client.close_session()
        _bambu_client = None

atexit.register(cleanup_resources)

if __name__ == '__main__':
    # This part is for direct execution (python app.py), not for `flask run` or ASGI.
    # It's primarily for testing the scheduler setup or running as a simple script.
    logger.info("Starting background services directly via __main__...")

    async def main_script_run():
        app.config['TESTING'] = False # Ensure not in testing mode for direct run
        await on_startup()
        try:
            while True: await asyncio.sleep(3600) # Keep alive for scheduler
        except KeyboardInterrupt:
            logger.info("Script interrupt received.")
        finally:
            await on_shutdown()

    asyncio.run(main_script_run())
