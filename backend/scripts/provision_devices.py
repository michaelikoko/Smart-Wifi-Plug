import argparse
import logging
from sqlmodel import Session, select
from db.session import engine
import models
from models.device import Device

# Setup basic logging
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("factory-provision")

def provision_devices(device_ids: list[str]):
    """
    Simulates a factory provisioning process by injecting valid, 
    unassigned device IDs into the database.

    To use, activate the virtual environment and run in the terminal:
    $ python -m scripts.provision_devices.py esp32-smartplug-001
    For multiple devices:
    $ python -m scripts.provision_devices.py esp32-smartplug-002 plug_01 esp-mac-1234
    """
    logger.info("Starting factory provisioning for %s device(s)...", len(device_ids))
    
    with Session(engine) as session:
        added_count = 0
        for d_id in device_ids:
            # Check if it already exists
            existing = session.exec(
                select(Device).where(Device.device_id == d_id)
            ).first()
            
            if existing:
                logger.warning("Skipped: Device '%s' already exists in the database.", d_id)
                continue
            
            # Create the unassigned device
            new_device = Device(
                device_id=d_id,
                name=f"Smart Plug ({d_id[-4:]})",  # Temporary placeholder name
                is_enabled=False,                  # Disabled until claimed by a user
                user_id=None                       # Unassigned pool
            )
            session.add(new_device)
            added_count += 1
            logger.info("Provisioned: '%s'", d_id)
        
        # Commit the batch
        if added_count > 0:
            session.commit()
            logger.info("Successfully committed %s new device(s) to the database.", added_count)
        else:
            logger.info("No new devices were added.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Inject valid ESP32 Device IDs into the database.")
    parser.add_argument(
        "device_ids", 
        nargs="+", 
        help="One or more device IDs to provision (e.g., esp32-smartplug-001)"
    )
    
    args = parser.parse_args()
    
    try:
        provision_devices(args.device_ids)
    except Exception as e:
        logger.error("Provisioning failed: %s", e)