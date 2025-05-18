import os
import json
import logging
import subprocess
from flask import (
    Blueprint, request, render_template, jsonify, send_from_directory,
    abort, flash, redirect, url_for, current_app
)
from werkzeug.utils import secure_filename

# Import from your "functions.py"
from functions import generate_files, allowed_file, ensure_directory_exists, get_dynamic_groups

routes_bp = Blueprint('routes', __name__)

# Ensure core directories exist
os.makedirs("./uploads", exist_ok=True)
os.makedirs("./diagrams", exist_ok=True)


# -----------------------
# 🚀 MAIN ROUTES
# -----------------------
@routes_bp.route('/')
def index():
    material = current_app.config.get('MATERIAL')
    return render_template('index.html', material=material)


@routes_bp.route('/config')
def config_page():
    return render_template('config.html', config=current_app.config)


@routes_bp.route('/api_test_utility')
def api_test_utility():
    return render_template('api_test_utility.html')


@routes_bp.route('/rules_extraction_utility')
def rules_extraction_utility():
    return render_template('rules_extraction_utility.html')


@routes_bp.route('/catalog')
def catalog():
    return render_template('catalog.html')


@routes_bp.route('/search')
def search_page():
    return render_template('search.html')


@routes_bp.route("/api/config_json", methods=["GET"])
def get_config_json():
    """
    Returns the config/config.json contents as JSON via /api/config_json.
    """
    config_path = os.path.join(current_app.root_path, "config", "config.json")
    if not os.path.exists(config_path):
        logging.error("Config file not found: %s", config_path)
        return jsonify({"error": "Config not found"}), 404

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data)  # Return a valid JSON response
    except json.JSONDecodeError as e:
        logging.exception("Invalid JSON in config file: %s", e)
        return jsonify({"error": "Invalid JSON format"}), 500
    except Exception as e:
        logging.exception("Error reading config file: %s", e)
        return jsonify({"error": str(e)}), 500


# -----------------------
# 📂 DIAGRAM ROUTES
# -----------------------
@routes_bp.route('/view_diagram')
def view_diagram():
    root_name = request.args.get('root_name')
    diagram_name = request.args.get('diagramName') or request.args.get('diagram')
    if not root_name or not diagram_name:
        abort(400, "Missing required parameters: 'root_name' and 'diagramName'")

    diagram_folder = os.path.join(current_app.config['DIAGRAMS_FOLDER'], root_name)
    if not os.path.isdir(diagram_folder):
        abort(404, f"Root directory '{root_name}' not found.")

    diagram_path = os.path.join(diagram_folder, diagram_name)
    if not os.path.isfile(diagram_path):
        abort(404, f"Diagram file '{diagram_name}' not found.")

    try:
        with open(diagram_path, "r", encoding="utf-8") as file:
            mermaid_code = file.read()
    except Exception as e:
        abort(500, f"Error reading diagram file: {e}")

    return render_template('diagram_viewer.html',
                           root_name=root_name,
                           diagram_name=diagram_name,
                           mermaid_code=mermaid_code)


@routes_bp.route('/api/diagrams/<root_name>', methods=['GET'])
def get_diagrams(root_name):
    diagram_dir = os.path.join(current_app.config['DIAGRAMS_FOLDER'], root_name)
    if not os.path.exists(diagram_dir):
        return jsonify({"error": "Diagram directory not found"}), 404

    diagrams = [f for f in os.listdir(diagram_dir) if f.endswith('.mmd')]
    if not diagrams:
        return jsonify({"error": "No diagrams found"}), 404

    return jsonify({"diagrams": diagrams})


@routes_bp.route('/diagrams/<root_name>/<filename>')
def diagrams_file(root_name, filename):
    try:
        directory = os.path.join(current_app.config['DIAGRAMS_FOLDER'], root_name)
        return send_from_directory(directory, filename)
    except FileNotFoundError:
        return "File not found", 404
    except Exception as e:
        return f"An error occurred while sending the file: {e}", 500


@routes_bp.route('/api/diagram_catalogs', methods=['GET'])
def diagram_catalogs():
    """Returns a list of diagram groups categorized by their directory names."""
    diagrams_folder = current_app.config['DIAGRAMS_FOLDER']
    if not os.path.exists(diagrams_folder):
        return jsonify([])

    catalog_dict = {}

    for folder in os.listdir(diagrams_folder):
        folder_path = os.path.join(diagrams_folder, folder)
        if not os.path.isdir(folder_path):
            continue  # Skip files

        # Extract meaningful category prefix (everything before `_Rules`)
        category = folder.rsplit('_Rules', 1)[0]

        if category not in catalog_dict:
            catalog_dict[category] = {"category": category, "entries": {}}

        for filename in os.listdir(folder_path):
            if filename.endswith('.mmd') or filename.endswith('.json'):
                base_name = os.path.splitext(filename)[0]  # Remove extension

                if base_name not in catalog_dict[category]["entries"]:
                    catalog_dict[category]["entries"][base_name] = {
                        "root": folder,
                        "diagram": None,
                        "hierarchy": None
                    }

                if filename.endswith('.mmd'):
                    catalog_dict[category]["entries"][base_name]["diagram"] = base_name
                elif filename.endswith('.json'):
                    catalog_dict[category]["entries"][base_name]["hierarchy"] = base_name

    # Convert dictionary to list format
    catalog_list = []
    for category, data in catalog_dict.items():
        catalog_list.append({"category": category, "entries": list(data["entries"].values())})

    return jsonify(catalog_list)


# -----------------------
# 📁 HIERARCHY
# -----------------------
@routes_bp.route('/view_hierarchy')
def view_hierarchy():
    root_name = request.args.get('root_name')
    diagram_name = request.args.get('diagramName')
    if not root_name or not diagram_name:
        abort(400, "Missing required root_name or diagramName")

    base = os.path.splitext(diagram_name)[0]
    json_file = f"{base}.json"
    hierarchy_dir = os.path.join(current_app.config['DIAGRAMS_FOLDER'], root_name)
    json_path = os.path.join(hierarchy_dir, json_file)
    if not os.path.exists(json_path):
        abort(404, f"Hierarchy data not found: {json_path}")

    return render_template('hierarchy_viewer.html',
                           root_name=root_name,
                           diagram_name=diagram_name)


@routes_bp.route('/api/hierarchy/<root_name>/<diagram_name>', methods=['GET'])
def get_hierarchy_data(root_name, diagram_name):
    """Fetch hierarchy JSON data for a given root_name and diagram_name, ensuring valid response."""
    json_file = f"{os.path.splitext(diagram_name)[0]}.json"
    hierarchy_dir = os.path.join(current_app.config['DIAGRAMS_FOLDER'], root_name)
    json_path = os.path.join(hierarchy_dir, json_file)

    logging.debug(f"Fetching hierarchy for: {root_name}/{diagram_name}")
    logging.debug(f"Looking for JSON at: {json_path}")

    if not os.path.exists(json_path):
        logging.error(f"Hierarchy file not found: {json_path}")
        return jsonify({"error": "Hierarchy data not found", "path": json_path}), 404

    try:
        with open(json_path, 'r', encoding='utf-8') as file:
            hierarchy_data = json.load(file)

        # If the JSON is wrapped in an object with a "rules" key, extract the rules list.
        if isinstance(hierarchy_data, dict) and "rules" in hierarchy_data:
            hierarchy_data = hierarchy_data["rules"]

        # Validate that the data is now a list of rules.
        if not isinstance(hierarchy_data, list) or len(hierarchy_data) == 0:
            logging.error(f"Invalid hierarchy data format: {json_path}")
            return jsonify({"error": "Invalid hierarchy data", "file": json_path}), 500

        return jsonify(hierarchy_data)

    except json.JSONDecodeError:
        logging.exception(f"JSON decoding error for file: {json_path}")
        return jsonify({"error": "Invalid JSON format in hierarchy file", "file": json_path}), 500

    except Exception as e:
        logging.exception(f"Error loading hierarchy JSON: {json_path}")
        return jsonify({"error": str(e), "file": json_path}), 500


# -----------------------
# CONFIG
# -----------------------
@routes_bp.route('/api/update_attributes', methods=['POST'])
def update_attributes():
    """Update only the displayed_attributes section in config.json"""
    config_path = os.path.join(current_app.root_path, 'config', 'config.json')
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)

        new_attributes = request.get_json().get("displayed_attributes", [])
        if not isinstance(new_attributes, list):
            return jsonify({'status': 'error', 'message': 'Invalid data format. Expected a list.'}), 400

        config["displayed_attributes"] = new_attributes
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)

        return jsonify({'status': 'success', 'updated_attributes': new_attributes})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@routes_bp.route('/api/config', methods=['POST'])
def update_config():
    new_config = request.get_json() or {}
    config_path = os.path.join(current_app.root_path, 'config', 'config.json')
    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(new_config, f, ensure_ascii=False, indent=2)
        return jsonify({'status': 'success', 'updatedConfig': new_config})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@routes_bp.route('/config/config.json', methods=['GET'])
def serve_config_file():
    config_dir = os.path.join(os.path.dirname(__file__), 'config')
    return send_from_directory(config_dir, 'config.json')


# -----------------------
# 🔍 SEARCH & CATALOG MANAGEMENT
# -----------------------
@routes_bp.route('/api/search_diagrams', methods=['GET'])
def search_diagrams():
    query = request.args.get('q', '').lower()
    results = []
    diagrams_dir = current_app.config['DIAGRAMS_FOLDER']
    for root_name in os.listdir(diagrams_dir):
        catalog_path = os.path.join(diagrams_dir, root_name)
        if os.path.isdir(catalog_path):
            for filename in os.listdir(catalog_path):
                if filename.endswith('.mmd'):
                    file_path = os.path.join(catalog_path, filename)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read().lower()
                        if query in content:
                            results.append({"catalog": root_name, "filename": filename})
    return jsonify(results)


@routes_bp.route('/catalog/rename/<filename>', methods=['POST'])
def rename_catalog_entry(filename):
    old_file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    data = request.get_json() or {}
    new_filename = data.get('new_filename', '').strip()
    if not new_filename:
        return jsonify({'status': 'error', 'message': 'New filename not provided'}), 400
    new_file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], new_filename)
    try:
        os.rename(old_file_path, new_file_path)
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


# -----------------------
# 📂 FILE UPLOADS & EXECUTION
# -----------------------
@routes_bp.route('/execute_file', methods=['POST'])
def execute_file():
    try:
        result = subprocess.run(
            ['D:/rri/ddce_dev/bin/PullACRules_v2.exe'],
            capture_output=True,
            text=True
        )
        return jsonify({'output': result.stdout, 'error': result.stderr})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@routes_bp.route('/upload', methods=['GET', 'POST'])
def upload_file():
    """
    Upload multiple .json files. Save them to UPLOAD_FOLDER, then call generate_files(...)
    to produce .mmd diagrams and .json hierarchy in DIAGRAMS_FOLDER.
    Redirects to catalog after successful upload.
    """
    if request.method == 'GET':
        return render_template('upload.html')

    if 'files' not in request.files:
        logging.error("No file part in request.")
        return jsonify(success=False, message="No files provided"), 400

    files = request.files.getlist("files")
    if not files:
        logging.error("No files selected.")
        return jsonify(success=False, message="No files selected"), 400

    output_dir = current_app.config['DIAGRAMS_FOLDER']  # Main directory for diagrams
    uploaded_files = []  # Keep track of uploaded file names for logging

    for file in files:
        if file.filename == '':
            logging.error("One of the files has no name.")
            return jsonify(success=False, message="One or more files have no name"), 400

        if not allowed_file(file.filename):
            logging.error(f"Unsupported file format: {file.filename}")
            return jsonify(success=False, message=f"Invalid file format: {file.filename}"), 400

        # Secure and save the file
        filename = secure_filename(file.filename)
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        uploaded_files.append(filename)

        logging.info(f"Saved uploaded file: {file_path}")

        # Load JSON data
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                json_data = json.load(f)
        except json.JSONDecodeError:
            logging.error(f"Invalid JSON format in file: {filename}")
            return jsonify(success=False, message=f"Invalid JSON format in {filename}"), 400

        # Build output directory per file
        root_name = os.path.splitext(filename)[0]
        main_output_dir = os.path.join(output_dir, root_name)
        ensure_directory_exists(main_output_dir)

        # Generate diagrams and hierarchy
        generate_files(json_data, main_output_dir)

    logging.info(f"Successfully processed {len(uploaded_files)} files: {uploaded_files}")

    # Redirect to catalog page after all files are processed
    return jsonify(success=True, message="Files uploaded successfully", redirect_url=url_for("routes.catalog"))


# -----------------------
# 📜 LOGS & WEBHOOKS
# -----------------------
@routes_bp.route('/api/logs')
def get_logs():
    try:
        with open("error.log", "r", encoding="utf-8") as log_file:
            return log_file.read(), 200, {"Content-Type": "text/plain"}
    except Exception as e:
        return str(e), 500


@routes_bp.route('/webhook_listener', methods=['POST'])
def webhook_listener():
    data = request.get_json()
    return jsonify({"status": "success", "received_data": data})
