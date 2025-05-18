import json
import os
import logging

def load_configurations():
    """Load configurations from config.json file."""
    config_path = os.path.join(os.path.dirname(__file__), 'config', 'config.json')
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        logging.warning(f"Config file not found at {config_path}, using empty config")
        return {}
    except json.JSONDecodeError:
        logging.error(f"Invalid JSON in config file at {config_path}, using empty config")
        return {} 