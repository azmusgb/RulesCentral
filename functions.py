import json
import logging
import uuid
import os

from config import load_configurations
from werkzeug.utils import secure_filename

# Load configurations
CONFIG = load_configurations()


def allowed_file(filename):
    """Check if the uploaded file has a valid extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'json'}


def ensure_directory_exists(directory):
    """Ensure the directory exists, create it if necessary."""
    if not os.path.exists(directory):
        try:
            os.makedirs(directory, exist_ok=True)
            logging.info(f"ensure_directory_exists: Created directory {directory}")
        except Exception as e:
            logging.error(f"ensure_directory_exists: Failed to create {directory}: {e}")


def add_missing_guids_if_needed(rules):
    """Recursively add GUIDs to rules if they are missing."""

    def recurse(rule):
        if not rule.get("RuleGUID"):
            rule["RuleGUID"] = f"udf_{uuid.uuid4()}"
        for child in rule.get("Children", []):
            recurse(child)
        for action in rule.get("Actions", []):
            for c in action.get("ChildRules", []):
                recurse(c)

    for top_rule in rules:
        recurse(top_rule)


def load_and_sanitize_json(filepath):
    """Load and sanitize JSON data from a file."""
    try:
        with open(filepath, "r", encoding="utf-8") as file:
            content = file.read()
            if content.lstrip().startswith("<"):
                raise ValueError("Uploaded file appears to be HTML, not valid JSON.")
            file.seek(0)
            data = json.load(file)
            if isinstance(data, dict) and "rules" in data:
                data = data["rules"]
            if not isinstance(data, list):
                raise ValueError("JSON data must be a list of rules.")
            for rule in data:
                if "RuleName" not in rule:
                    rule["RuleName"] = "Unnamed"
            add_missing_guids_if_needed(data)
            logging.info(f"JSON file {filepath} successfully loaded. Missing GUIDs assigned if needed.")
            return data
    except (json.JSONDecodeError, FileNotFoundError, ValueError) as e:
        logging.error(f"Error loading JSON file {filepath}: {e}")
        return None


def get_dynamic_groups(diagrams_folder):
    """Dynamically groups directories based on shared prefixes before the second underscore, or full folder name if no second underscore exists."""
    if not os.path.exists(diagrams_folder):
        return []

    grouped_catalog = {}

    for folder in os.listdir(diagrams_folder):
        folder_path = os.path.join(diagrams_folder, folder)
        if not os.path.isdir(folder_path):
            continue

        # Extract category name (use first two parts of the name if underscores exist)
        parts = folder.split("_")
        prefix = "_".join(parts[:2]) if len(parts) > 1 else folder

        if prefix not in grouped_catalog:
            grouped_catalog[prefix] = {"category": prefix, "entries": []}

        for filename in os.listdir(folder_path):
            if filename.endswith('.mmd') or filename.endswith('.json'):
                base_name = os.path.splitext(filename)[0]
                existing_entry = next((e for e in grouped_catalog[prefix]["entries"] if e["root"] == folder), None)

                if not existing_entry:
                    grouped_catalog[prefix]["entries"].append({
                        "root": folder,
                        "diagram": base_name if filename.endswith('.mmd') else None,
                        "hierarchy": base_name if filename.endswith('.json') else None
                    })
                else:
                    if filename.endswith('.mmd'):
                        existing_entry["diagram"] = base_name
                    elif filename.endswith('.json'):
                        existing_entry["hierarchy"] = base_name

    return list(grouped_catalog.values())


def flatten_rules(rules):
    """
    Flatten a nested structure of rules (Children, Actions->ChildRules) into
    a single list, ensuring each rule has a valid 'ParentGUID' reference.
    """
    flat_list = []
    seen = set()

    def dfs(rule, parent_guid=None, parent_action_index=None):
        guid = rule.get("RuleGUID")
        if not guid:
            guid = f"udf_{uuid.uuid4()}"
            rule["RuleGUID"] = guid  # Assign GUID if missing

        rule["ParentGUID"] = parent_guid  # Set parent GUID correctly
        rule["ParentActionIndex"] = parent_action_index

        if guid in seen:
            return
        seen.add(guid)

        flat_list.append(rule)

        # Process children recursively
        for child in rule.get("Children", []):
            dfs(child, guid, None)  # Assign current rule as parent

        # Process actions and their child rules
        for i, action in enumerate(rule.get("Actions", [])):
            for child_rule in action.get("ChildRules", []):
                dfs(child_rule, guid, i)  # Assign action index

    # **Ensure top-level nodes have `ParentGUID: null`**
    for r in rules:
        dfs(r, parent_guid=None)

    return flat_list


def escape_mermaid_chars(text):
    """Escape special characters for Mermaid syntax."""
    return (
        text.replace('"', '\\"')
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('&lt;br&gt;', '<br>')
        .replace('(', '- ')
        .replace(')', '')
    )


def apply_translations(text):
    """Apply translations to the given text based on the configuration."""
    for key, value in CONFIG.get('translations', {}).items():
        text = text.replace(key, value)
    return text


def get_node_label(rule, clickable=False):
    """Generate a label for a node based on its attributes."""
    label = rule.get("RuleName", "")
    if "FunctionName" in rule and rule["FunctionName"]:
        label += f"<br>Function: {rule['FunctionName']}"
    label = apply_translations(label)
    label = escape_mermaid_chars(label)
    if clickable:
        label += " ↪"
    return label


def get_node_shape(rule):
    """Determine the shape of a node based on its name."""
    rname = rule.get("RuleName", "").lower()
    if "?" in rname:
        return "diamond"
    if "plug" in rname:
        return "plug"
    if "set" in rname:
        return "set"
    return "rect"


def build_sibling_chain(rule, edges):
    """Build sibling chains for a given rule."""
    parent_guid = rule["RuleGUID"]
    children = rule.get("Children", [])
    action_names = []  # List to collect ActionNames

    if children:
        first_child_guid = children[0]["RuleGUID"]
        edges.append({
            "edge_str": f"{parent_guid} --> {first_child_guid}",
            "edge_type": "PC",
            "label": ""
        })
        for i in range(len(children) - 1):
            edges.append({
                "edge_str": f"{children[i]['RuleGUID']} --> {children[i + 1]['RuleGUID']}",
                "edge_type": "SB",
                "label": ""
            })

    for action in rule.get("Actions", []):
        child_rules = action.get("ChildRules", [])
        if child_rules:
            action_name = action.get("ActionName", "").strip()
            if action_name.strip() == "---":
                action_name = "Continue"
            label_part = f"|{escape_mermaid_chars(action_name)}|" if action_name else ""
            first_c_guid = child_rules[0]["RuleGUID"]
            edges.append({
                "edge_str": f"{parent_guid} -->{label_part} {first_c_guid}",
                "edge_type": "PC",
                "label": action_name
            })
            for i in range(len(child_rules) - 1):
                edges.append({
                    "edge_str": f"{child_rules[i]['RuleGUID']} --> {child_rules[i + 1]['RuleGUID']}",
                    "edge_type": "SB",
                    "label": ""
                })
            if action_name:  # Collect non-empty ActionNames
                action_names.append(action_name)

    for c in children:
        build_sibling_chain(c, edges)
    for action in rule.get("Actions", []):
        for c in action.get("ChildRules", []):
            build_sibling_chain(c, edges)

    # Print or return the collected ActionNames
    if action_names:
        print("ActionNames found:", action_names)
    return action_names


def build_all_edges(rules):
    """Build all edges for the given rules."""
    edges = []
    action_names = []  # List to collect all ActionNames
    top_level = [r for r in rules if r.get("ParentGUID") is None]
    for rule in top_level:
        action_names.extend(build_sibling_chain(rule, edges))
    return edges, action_names


def build_nodes(flat_rules, group_ids=None, root_name="", edge_map=None, rule_to_page=None, current_page=None):
    """Build nodes for the Mermaid diagram."""
    nodes = {}
    for rule in flat_rules:
        guid = rule["RuleGUID"]
        rule["RootName"] = root_name
        if group_ids is not None:
            children = rule.get("Children", [])
            if children:
                clickable = any(child["RuleGUID"] not in group_ids for child in children)
            else:
                clickable = False
                if edge_map is not None and guid in edge_map:
                    clickable = any(child_guid not in group_ids for child_guid in edge_map[guid])
        else:
            has_children = bool(rule.get("Children")) or any("ChildRules" in a and a["ChildRules"]
                                                             for a in rule.get("Actions", []))
            clickable = has_children
        label = get_node_label(rule, clickable=clickable)
        shape = get_node_shape(rule)
        if shape == "diamond":
            node_str = f'{guid}{{"{label}"}}'
        else:
            node_str = f'{guid}["{label}"]'
        disabled = rule.get("Attributes", {}).get("_Disabled") in ["1", 1, True]
        if disabled:
            node_str += ':::classDisabled'
        else:
            node_str += f':::class{shape}'
        node_str = node_str.rstrip() + "\n"
        if clickable:
            node_str += f"{get_node_click(rule, rule_to_page, current_page, root_name, edge_map)}\n"
        nodes[guid] = node_str
    return nodes


def get_node_click(rule, rule_to_page, current_page, root_name, edge_map):
    """Generate click event for a node."""
    guid = rule["RuleGUID"]
    target_page = None
    if edge_map and guid in edge_map and rule_to_page is not None and current_page is not None:
        for child_guid in edge_map[guid]:
            if rule_to_page.get(child_guid, current_page) != current_page:
                target_page = rule_to_page[child_guid]
                break
    if target_page is not None:
        return f'click {guid} "/view_diagrams/{root_name}?page={target_page}" "View Page {target_page}"'


def generate_mermaid_code(nodes, edges, current_page, total_pages, root_name, layout="TD"):
    """Generate Mermaid code for the diagram."""
    code = f"flowchart {layout}\n"
    for node_str in nodes.values():
        for line in node_str.splitlines():
            code += "    " + line + "\n"
    for i, edge_info in enumerate(edges):
        edge_str = edge_info["edge_str"]
        edge_type = edge_info["edge_type"]
        code += f"    {edge_str}\n"
        if edge_type == "PC":
            code += f"    linkStyle {i} stroke:#000,stroke-width:2px;\n"
        elif edge_type == "SB":
            code += f"    linkStyle {i} stroke:#666,stroke-dasharray:3,stroke-width:2px;\n"
    code += '''
    classDef classrect fill:#7fbfff;
    classDef classdiamond fill:#a5d6a7;
    classDef classplug fill:#48cae4;
    classDef classset fill:#ffcc80;
    classDef classDisabled fill:#a8a8a8;
    '''
    return code


def find_rule_by_guid(rules, guid):
    """Find a rule by its GUID."""
    for rule in rules:
        if rule.get("RuleGUID") == guid:
            return rule
        if "Children" in rule:
            found = find_rule_by_guid(rule["Children"], guid)
            if found:
                return found
        if "Actions" in rule:
            for action in rule.get("Actions", []):
                if "ChildRules" in action:
                    found = find_rule_by_guid(action["ChildRules"], guid)
                    if found:
                        return found
    return None


def update_mmd_files_with_translations(diagrams_folder, translations):
    """Update .mmd files in the given folder with translations."""
    for filename in os.listdir(diagrams_folder):
        if filename.endswith(".mmd"):
            filepath = os.path.join(diagrams_folder, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                for key, replacement in translations.items():
                    content = content.replace(key, replacement)
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)
                logging.info(f"Updated translations in {filename}")
            except Exception as e:
                logging.error(f"Error updating {filename}: {e}")


def propagate_disabled_rules(rules, inherited_disabled=False):
    """Propagate the disabled state through the rules."""
    for rule in rules:
        current_disabled = inherited_disabled or (rule.get("Attributes", {}).get("_Disabled") in ["1", 1, True])
        if "Attributes" not in rule:
            rule["Attributes"] = {}
        if current_disabled:
            rule["Attributes"]["_Disabled"] = "1"
        if "Children" in rule:
            propagate_disabled_rules(rule["Children"], current_disabled)
        if "Actions" in rule:
            for action in rule.get("Actions", []):
                if "ChildRules" in action:
                    propagate_disabled_rules(action["ChildRules"], current_disabled)


def build_edge_map(edges):
    """Build a mapping of edges for quick access."""
    edge_map = {}
    for edge in edges:
        parts = edge["edge_str"].split("-->")
        if len(parts) == 2:
            left = parts[0].strip()
            right = parts[1].strip()
            if "|" in right:
                right = right.split("|")[-1].strip()
            edge_map.setdefault(left, []).append(right)
    return edge_map


def generate_files(json_data: list, output_dir: str) -> None:
    """
    Process the input JSON data and generate output files directly into the main output directory.
    Each unique container in the JSON will yield:
      - A Mermaid diagram file named <container>.mmd.
      - A JSON file containing the rules and the action names for that container named <container>.json.
    """
    logging.info(f"Processing {len(json_data)} rules...")
    os.makedirs(output_dir, exist_ok=True)

    propagate_disabled_rules(json_data)
    flat_rules = flatten_rules(json_data)
    edges, _ = build_all_edges(json_data)  # We already log/print global action names here.
    edge_map = build_edge_map(edges)
    logging.info(f"Processed {len(flat_rules)} flat rules and {len(edges)} edges.")

    # Group the flat rules by their unique Container value.
    container_groups = {}
    for rule in flat_rules:
        container = rule.get("Container")
        if not container:
            container = os.path.basename(output_dir)
        container_groups.setdefault(container, []).append(rule)

    total_containers = len(container_groups)
    root_name = os.path.basename(output_dir)
    logging.info(f"Found {total_containers} unique container(s) in the data.")

    # For each container group, generate a Mermaid diagram file and a container JSON file.
    for container, rules in container_groups.items():
        group_ids = {r["RuleGUID"] for r in rules}
        group_nodes = build_nodes(
            rules,
            group_ids=group_ids,
            root_name=root_name,
            edge_map=edge_map,
            rule_to_page=None,  # No pagination
            current_page=1
        )
        group_edges = [
            e for e in edges
            if e["edge_str"].split("-->")[0].strip() in group_ids
        ]

        # Collect non-empty ActionNames for this container.
        container_action_names = set()
        for rule in rules:
            for action in rule.get("Actions", []):
                name = action.get("ActionName", "").strip()
                if name and name != "---":  # Optionally replace '---' with a specific value if needed.
                    container_action_names.add(name)

        mermaid_code = generate_mermaid_code(
            group_nodes,
            group_edges,
            root_name=root_name,
            current_page=1,
            total_pages=1,
            layout="TD"
        )

        # Append the ActionNames as a comment at the end of the Mermaid code if any.
        if container_action_names:
            mermaid_code += "\n%% ActionNames: " + ", ".join(sorted(container_action_names))

        sanitized_container = secure_filename(container)
        diagram_filename = f"{sanitized_container}.mmd"
        diagram_path = os.path.join(output_dir, diagram_filename)
        with open(diagram_path, "w", encoding="utf-8") as f:
            f.write(mermaid_code)
        logging.info(f"Created diagram file '{diagram_filename}' with {len(group_nodes)} nodes.")

        # Create a JSON output that includes both the rules and the ActionNames.
        output_data = {
            "rules": rules,
            "actionNames": sorted(list(container_action_names))
        }
        container_json_path = os.path.join(output_dir, f"{sanitized_container}.json")
        with open(container_json_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=4)
        logging.info(f"Saved container JSON to '{container_json_path}'.")
