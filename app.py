import logging
import os

from dotenv import load_dotenv
from flask import Flask
from flask_material import Material

from config import load_configurations
from routes import routes_bp

# -------------------------------------------------------------------
# Environment & App Setup
# -------------------------------------------------------------------
load_dotenv()


def create_app():
    app = Flask(__name__, static_folder='static', static_url_path='/static')
    material = Material(app)
    app.secret_key = os.getenv('SECRET_KEY', 'default_secret_key')

    # Ensure config variables are loaded
    app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'uploads')
    app.config['DIAGRAMS_FOLDER'] = os.getenv('DIAGRAMS_FOLDER', 'diagrams')
    app.config['MATERIAL'] = material

    logging.info(f"App Config: UPLOAD_FOLDER = {app.config['UPLOAD_FOLDER']}")
    logging.info(f"App Config: DIAGRAMS_FOLDER = {app.config['DIAGRAMS_FOLDER']}")

    return app, material


app, material = create_app()

# Register blueprints
app.register_blueprint(routes_bp)

# Configure logging
logging.basicConfig(level=logging.DEBUG,
                    format="%(asctime)s - %(levelname)s - %(message)s")

# Check paths
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config', 'config.json')
logging.info(f"Checking Configuration File: {CONFIG_PATH}, Exists: {os.path.exists(CONFIG_PATH)}")
logging.info(
    f"Checking Upload Folder: {app.config['UPLOAD_FOLDER']}, Exists: {os.path.exists(app.config['UPLOAD_FOLDER'])}")
logging.info(
    f"Checking Diagrams Folder: {app.config['DIAGRAMS_FOLDER']}, Exists: {os.path.exists(app.config['DIAGRAMS_FOLDER'])}")

# Load Configurations
CONFIG = load_configurations()

# Ensure Upload and Diagram folders exist
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    logging.warning("UPLOAD_FOLDER does not exist. Creating now...")
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

if not os.path.exists(app.config['DIAGRAMS_FOLDER']):
    logging.warning("DIAGRAMS_FOLDER does not exist. Creating now...")
    os.makedirs(app.config['DIAGRAMS_FOLDER'], exist_ok=True)

# -------------------------------------------------------------------
# Run Application
# -------------------------------------------------------------------
if __name__ == '__main__':
    logging.info("Starting Flask Application on 127.0.0.1:8080")
    app.run(debug=True, host='127.0.0.1', port=8080)
