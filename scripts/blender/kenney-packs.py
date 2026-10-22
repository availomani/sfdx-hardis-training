"""
Merges the Kenney models Guinea Run uses into one glTF binary per theme, so a
world loads one small file instead of dozens.

Kenney's kits are CC0 (https://kenney.nl): unzip them anywhere, then

    blender --background --factory-startup --python scripts/blender/kenney-packs.py -- \
        <folder holding the unzipped kenney_* kits> site-theme/javascripts/guinea-run/models

Each model becomes one top-level node named after its file (desk, coin-gold...),
centred on its footprint and standing on y = 0, so the game finds it with
getObjectByName and drops it on the floor.
"""

import os
import sys

import bpy

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
KITS = ARGS[0] if ARGS else "."
OUT = ARGS[1] if len(ARGS) > 1 else "."

PACKS = {
    # Worlds 3 and 5: the office of the guinea pig and of Mariia
    "office": ("kenney_furniture-kit", [
        "desk", "deskCorner", "chairDesk", "computerScreen", "computerKeyboard", "computerMouse", "laptop",
        "pottedPlant", "plantSmall1", "plantSmall2", "rugRound", "rugRounded", "bookcaseOpen", "books",
        "lampRoundTable", "coatRack", "trashcan", "cardboardBoxClosed", "cardboardBoxOpen",
        "kitchenCoffeeMachine", "speaker", "loungeSofa", "sideTable", "wallWindow",
    ]),
    # Worlds 1, 6 and 8, and the runners: blocks, coins, traps, flags
    "platform": ("kenney_platformer-kit", [
        "block-grass", "block-grass-large", "block-grass-long", "block-grass-low", "block-grass-low-long",
        "block-snow", "platform", "platform-ramp", "block-moving", "block-moving-blue",
        "coin-gold", "coin-silver", "coin-bronze", "star", "heart", "jewel", "key", "lock",
        "flag", "crate", "crate-strong", "chest", "spring", "spike-block", "trap-spikes", "saw", "bomb",
        "button-round", "lever", "door-large-open", "sign", "arrow", "arrows", "fence-straight", "fence-low-straight",
        "tree", "tree-pine", "flowers", "flowers-tall", "mushrooms", "rocks", "stones", "barrel", "ladder",
        "conveyor-belt", "pipe", "grass", "plant", "hedge",
    ]),
    # The scenery of the runners
    "nature": ("kenney_nature-kit", [
        "tree_default", "tree_oak", "tree_palm", "tree_pineRoundA", "tree_fat", "tree_blocks", "tree_cone",
        "plant_bush", "plant_bushLarge", "flower_redA", "flower_yellowA", "flower_purpleA",
        "rock_largeA", "rock_smallA", "mushroom_red", "stump_round", "grass_large", "log", "tent_smallOpen",
        "campfire_logs", "platform_grass",
    ]),
}


def models_folder(kit):
    base = os.path.join(KITS, kit, "Models")
    for name in ("GLB format", "GLTF format"):
        path = os.path.join(base, name)
        if os.path.isdir(path):
            return path
    raise SystemExit("no GLB folder in " + base)


def build(pack, kit, names):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    folder = models_folder(kit)
    roots = []
    for name in names:
        path = os.path.join(folder, name + ".glb")
        if not os.path.exists(path):
            print("missing", kit, name)
            continue
        before = set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        added = [o for o in bpy.context.scene.objects if o not in before]
        # The file's own nodes carry its name too: they step aside, so the
        # holder below gets the plain name the game looks up
        for i, obj in enumerate(added):
            obj.name = name + "-part" + str(i)
        # One empty per model holds its parts, named after the file
        holder = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(holder)
        for obj in added:
            if obj.parent is None:
                obj.parent = holder
        # Centre it on its footprint and stand it on the floor (Blender Z up)
        meshes = [o for o in added if o.type == "MESH"]
        if meshes:
            bpy.context.view_layer.update()
            xs, ys, zs = [], [], []
            for o in meshes:
                for corner in o.bound_box:
                    world = o.matrix_world @ __import__("mathutils").Vector(corner)
                    xs.append(world.x)
                    ys.append(world.y)
                    zs.append(world.z)
            dx, dy, dz = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
            for obj in added:
                if obj.parent is holder:
                    obj.location.x -= dx
                    obj.location.y -= dy
                    obj.location.z -= dz
        # Side by side, so nothing overlaps if someone opens the file
        holder.location = (len(roots) * 3.0, 0, 0)
        roots.append(holder)
    # Shared materials stay shared: the kits use one colour map per kit
    os.makedirs(OUT, exist_ok=True)
    target = os.path.join(OUT, pack + ".glb")
    bpy.ops.export_scene.gltf(filepath=target, export_format="GLB", export_yup=True, export_apply=True)
    print("exported", target, len(roots), "models")


selected = ARGS[2].split(",") if len(ARGS) > 2 else list(PACKS)
for pack in selected:
    kit, names = PACKS[pack]
    build(pack, kit, names)
