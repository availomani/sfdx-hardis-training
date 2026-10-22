"""
The Salesforce and sfdx-hardis items of Guinea Run, built from code in Blender,
and the Cloudity logo and the sfdx-hardis badge mark extruded from their SVG.

    blender --background --factory-startup --python scripts/blender/salesforce-items.py -- \
        site-theme/javascripts/guinea-run/models/salesforce.glb [preview.png]

Every item is one top-level node named after what it is, about one unit tall,
standing on the floor and centred, in the Lightning colours:

    org-cloud, scratch-cloud, custom-field, permission-set, flow, apex, lwc,
    record, package-xml, branch, pull-request, check-pass, check-warn,
    check-fail, apex-test, ci-runner, rocket, note, ticket, sfdx-hardis-badge,
    cloudity-logo

They are concepts of the course drawn in a Lightning style, not the marks of
Salesforce: no logo or mascot of theirs is copied.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGS[0] if ARGS else "salesforce.glb"
PREVIEW = ARGS[1] if len(ARGS) > 1 else None
HERE = os.path.dirname(os.path.abspath(__file__))
IMAGES = os.path.join(HERE, "..", "..", "site-theme", "images")

# The Lightning Design System palette
BRAND = (0.004, 0.463, 0.827)      # #0176D3
BRAND_LIGHT = (0.106, 0.588, 1.0)  # #1B96FF
NAVY = (0.012, 0.176, 0.376)       # #032D60
WHITE = (1, 1, 1)
GREEN = (0.18, 0.518, 0.29)        # #2E844A
ORANGE = (0.867, 0.478, 0.004)     # #DD7A01
YELLOW = (1.0, 0.718, 0.365)       # #FFB75D
RED = (0.918, 0.0, 0.118)          # #EA001E
PURPLE = (0.565, 0.314, 0.914)     # #9050E9
TEAL = (0.024, 0.647, 0.604)       # #06A59A
PINK = (0.89, 0.024, 0.416)        # #E3066A
GREY = (0.79, 0.79, 0.79)
NOTE = (1.0, 0.89, 0.42)


def srgb(c):
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


MATS = {}


def mat(name, color, roughness=0.35, metallic=0.0, coat=0.6, emit=0.0, alpha=1.0):
    key = name
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(color), 1)
    b.inputs["Roughness"].default_value = roughness
    b.inputs["Metallic"].default_value = metallic
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = coat
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = "BLENDED"
        else:
            m.blend_method = "BLEND"
    if emit:
        b.inputs["Emission Color"].default_value = (*srgb(color), 1)
        b.inputs["Emission Strength"].default_value = emit
    MATS[key] = m
    return m


def active():
    return bpy.context.view_layer.objects.active


def finish(obj, material, bevel=0.0, smooth=True):
    if material:
        obj.data.materials.clear()
        obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
    if smooth:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.shade_auto_smooth() if hasattr(bpy.ops.object, "shade_auto_smooth") else bpy.ops.object.shade_smooth()
    return obj


def box(size, loc, material, bevel=0.04, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = active()
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, material, bevel)


def cyl(radius, depth, loc, material, rot=(0, 0, 0), vertices=48, bevel=0.02):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=loc, rotation=rot, vertices=vertices)
    return finish(active(), material, bevel)


def sphere(radius, loc, material, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=32, ring_count=16)
    o = active()
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, material)


def cone(r1, r2, depth, loc, material, rot=(0, 0, 0), vertices=32):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot, vertices=vertices)
    return finish(active(), material, 0.01)


def torus(major, minor, loc, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc, rotation=rot, major_segments=40, minor_segments=12)
    return finish(active(), material)


def text(body, size, loc, material, depth=0.05, rot=(math.radians(90), 0, 0)):
    """Extruded text, standing up and facing -Y (the front in the game)."""
    bpy.ops.object.text_add(location=loc, rotation=rot)
    o = active()
    o.data.body = body
    o.data.size = size
    o.data.extrude = depth
    o.data.bevel_depth = 0.006
    o.data.bevel_resolution = 1
    o.data.resolution_u = 3
    o.data.align_x = "CENTER"
    o.data.align_y = "CENTER"
    bpy.ops.object.convert(target="MESH")
    o = active()
    return finish(o, material, smooth=False)


def prism(points, depth, loc, material, bevel=0.02, rot=(math.radians(90), 0, 0)):
    """A flat 2D outline (x, y) extruded by depth, standing up like a sign."""
    mesh = bpy.data.meshes.new("prism")
    verts = [(x, y, 0) for x, y in points] + [(x, y, depth) for x, y in points]
    n = len(points)
    faces = [list(range(n))[::-1], list(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, j + n, i + n])
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    o = bpy.data.objects.new("prism", mesh)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    o.location = loc
    return finish(o, material, bevel, smooth=False)


def bar(a, b, thickness, depth, material):
    """A rounded bar from a to b (x, z) in the front plane: checks, crosses, links."""
    ax, az = a
    bx, bz = b
    length = math.hypot(bx - ax, bz - az)
    angle = math.atan2(bz - az, bx - ax)
    return box((length + thickness, depth, thickness), ((ax + bx) / 2, -0.0, (az + bz) / 2), material, thickness * 0.45, (0, -angle, 0))


def group(name, parts, lift=True):
    """Joins the parts into one item named `name`, standing on the floor, centred."""
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
        for mod in list(p.modifiers):
            bpy.context.view_layer.objects.active = p
            bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = active()
    # A game item, not a print: no more than about 3,000 triangles each
    triangles = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if triangles > 4000:
        decimate = o.modifiers.new("Decimate", "DECIMATE")
        decimate.ratio = 3000 / triangles
        bpy.ops.object.modifier_apply(modifier="Decimate")
    o.name = name
    o.data.name = name
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    xs = [o.matrix_world @ Vector(c) for c in o.bound_box]
    minz = min(v.z for v in xs)
    cx = (min(v.x for v in xs) + max(v.x for v in xs)) / 2
    cy = (min(v.y for v in xs) + max(v.y for v in xs)) / 2
    bpy.context.scene.cursor.location = (cx, cy, minz)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    o.location = (0, 0, 0)
    return o


# ---------- The items ----------

def cloud(name, color, size=1.0):
    parts = []
    m = mat(name + "-body", color, 0.3, coat=0.8)
    for x, z, r in [(-0.38, 0.32, 0.26), (-0.12, 0.48, 0.34), (0.2, 0.52, 0.3), (0.44, 0.34, 0.24), (0.04, 0.28, 0.3)]:
        parts.append(sphere(r * size, (x * size, 0, z * size), m, (1, 0.7, 1)))
    # A flat underside, as clouds in icons have
    parts.append(box((1.06 * size, 0.36 * size, 0.18 * size), (0.03 * size, 0, 0.17 * size), m, 0.08 * size))
    return group(name, parts)


def custom_field():
    tile = mat("field-tile", NAVY, 0.4)
    white = mat("field-white", WHITE, 0.3, emit=0.4)
    orange = mat("field-cursor", ORANGE, 0.3, emit=0.8)
    parts = [box((0.9, 0.24, 0.9), (0, 0, 0.45), tile, 0.1)]
    # The input box and its blinking cursor
    parts.append(box((0.66, 0.06, 0.2), (0, -0.13, 0.42), white, 0.04))
    parts.append(box((0.03, 0.08, 0.15), (-0.18, -0.15, 0.42), orange, 0.01))
    # The label above it
    parts.append(box((0.36, 0.06, 0.06), (-0.15, -0.13, 0.67), white, 0.02))
    return group("custom-field", parts)


def permission_set():
    shield = mat("perm-shield", TEAL, 0.35, coat=0.8)
    gold = mat("perm-key", YELLOW, 0.25, metallic=0.6, emit=0.3)
    pts = [(-0.42, 0.5), (0.42, 0.5), (0.4, 0.05), (0.25, -0.3), (0, -0.5), (-0.25, -0.3), (-0.4, 0.05)]
    parts = [prism(pts, 0.2, (0, 0.1, 0.52), shield, 0.05)]
    # The key, on the front of the shield
    parts.append(torus(0.12, 0.035, (0, -0.06, 0.66), gold, (math.radians(90), 0, 0)))
    parts.append(box((0.06, 0.06, 0.38), (0, -0.06, 0.36), gold, 0.02))
    parts.append(box((0.12, 0.06, 0.05), (0.06, -0.06, 0.22), gold, 0.015))
    parts.append(box((0.09, 0.06, 0.05), (0.05, -0.06, 0.32), gold, 0.015))
    return group("permission-set", parts)


def flow():
    start = mat("flow-start", GREEN, 0.3, emit=0.2)
    decision = mat("flow-decision", ORANGE, 0.3, emit=0.2)
    end = mat("flow-end", BRAND, 0.3, emit=0.2)
    link = mat("flow-link", NAVY, 0.4)
    parts = [cyl(0.16, 0.14, (0, 0, 0.88), start, (math.radians(90), 0, 0))]
    parts.append(box((0.28, 0.14, 0.28), (0, 0, 0.5), decision, 0.03, (0, math.radians(45), 0)))
    parts.append(cyl(0.14, 0.14, (-0.32, 0, 0.12), end, (math.radians(90), 0, 0)))
    parts.append(cyl(0.14, 0.14, (0.32, 0, 0.12), end, (math.radians(90), 0, 0)))
    parts.append(bar((0, 0.72), (0, 0.69), 0.05, 0.06, link))
    parts.append(bar((0, 0.32), (-0.3, 0.24), 0.05, 0.06, link))
    parts.append(bar((0, 0.32), (0.3, 0.24), 0.05, 0.06, link))
    return group("flow", parts)


def apex():
    cube = mat("apex-cube", PURPLE, 0.35, coat=0.8)
    white = mat("apex-white", WHITE, 0.3, emit=0.5)
    parts = [box((0.86, 0.86, 0.86), (0, 0, 0.43), cube, 0.12)]
    parts.append(text("{ }", 0.62, (0, -0.44, 0.42), white, 0.06))
    return group("apex", parts)


def lwc():
    bolt = mat("lwc-bolt", (1.0, 0.72, 0.05), 0.3, coat=0.8, emit=0.25)
    pts = [(0.12, 0.6), (-0.3, -0.02), (-0.02, -0.02), (-0.16, -0.6), (0.32, 0.08), (0.04, 0.08), (0.2, 0.6)]
    return group("lwc", [prism(pts, 0.18, (0, 0.09, 0.6), bolt, 0.03)])


def record():
    card = mat("record-card", WHITE, 0.4)
    head = mat("record-head", BRAND, 0.35, emit=0.2)
    line = mat("record-line", GREY, 0.5)
    parts = [box((0.9, 0.1, 1.1), (0, 0, 0.55), card, 0.05)]
    parts.append(box((0.9, 0.11, 0.24), (0, -0.005, 0.98), head, 0.04))
    parts.append(sphere(0.07, (-0.32, -0.07, 0.98), mat("record-icon", WHITE, 0.3)))
    for i, w in enumerate((0.62, 0.5, 0.66, 0.4)):
        parts.append(box((w, 0.04, 0.06), (-0.33 + w / 2, -0.06, 0.72 - i * 0.16), line, 0.015))
    return group("record", parts)


def package_xml():
    carton = mat("package-box", BRAND, 0.45, coat=0.4)
    tape = mat("package-tape", BRAND_LIGHT, 0.4)
    white = mat("package-white", WHITE, 0.3, emit=0.5)
    parts = [box((0.9, 0.8, 0.72), (0, 0, 0.36), carton, 0.05)]
    parts.append(box((0.92, 0.18, 0.03), (0, 0, 0.73), tape, 0.01))
    parts.append(text("</>", 0.36, (0, -0.41, 0.36), white, 0.04))
    return group("package-xml", parts)


def branch():
    node = mat("branch-node", ORANGE, 0.3, coat=0.8, emit=0.2)
    line = mat("branch-line", NAVY, 0.4)
    parts = [sphere(0.12, (-0.2, 0, 0.12), node), sphere(0.12, (-0.2, 0, 0.88), node), sphere(0.12, (0.25, 0, 0.62), node)]
    parts.append(cyl(0.04, 0.76, (-0.2, 0, 0.5), line, vertices=16))
    parts.append(bar((0.25, 0.62), (-0.2, 0.3), 0.08, 0.08, line))
    return group("branch", parts)


def pull_request():
    node = mat("pr-node", GREEN, 0.3, coat=0.8, emit=0.2)
    line = mat("pr-line", NAVY, 0.4)
    parts = [sphere(0.12, (-0.25, 0, 0.12), node), sphere(0.12, (-0.25, 0, 0.88), node), sphere(0.12, (0.25, 0, 0.12), node)]
    parts.append(cyl(0.04, 0.76, (-0.25, 0, 0.5), line, vertices=16))
    parts.append(cyl(0.04, 0.5, (0.25, 0, 0.42), line, vertices=16))
    parts.append(bar((0.25, 0.68), (-0.02, 0.88), 0.07, 0.08, line))
    # The arrow head, pointing at the base branch
    parts.append(cone(0.09, 0, 0.16, (-0.06, 0, 0.88), line, (0, math.radians(-90), 0), 4))
    return group("pull-request", parts)


def check(name, color, kind):
    disc = mat(name + "-disc", color, 0.3, coat=0.9, emit=0.35)
    white = mat(name + "-mark", WHITE, 0.3, emit=0.8)
    parts = []
    if kind == "warn":
        parts.append(prism([(-0.5, -0.42), (0.5, -0.42), (0, 0.46)], 0.2, (0, 0.1, 0.44), disc, 0.06))
        parts.append(box((0.08, 0.06, 0.34), (0, -0.04, 0.5), white, 0.03))
        parts.append(sphere(0.05, (0, -0.04, 0.22), white))
    else:
        parts.append(cyl(0.48, 0.2, (0, 0, 0.48), disc, (math.radians(90), 0, 0), 64, 0.05))
        if kind == "pass":
            parts.append(bar((-0.22, 0.48), (-0.06, 0.32), 0.1, 0.1, white))
            parts.append(bar((-0.06, 0.32), (0.24, 0.64), 0.1, 0.1, white))
        else:
            parts.append(bar((-0.2, 0.28), (0.2, 0.68), 0.1, 0.1, white))
            parts.append(bar((-0.2, 0.68), (0.2, 0.28), 0.1, 0.1, white))
    for p in parts[1:]:
        p.location.y -= 0.1
    return group(name, parts)


def apex_test():
    glass = mat("test-glass", (0.85, 0.95, 1.0), 0.1, coat=1.0, alpha=0.35)
    liquid = mat("test-liquid", GREEN, 0.2, emit=0.6)
    parts = [cyl(0.2, 0.16, (0, 0, 0.72), glass, vertices=32)]
    parts.append(cone(0.42, 0.18, 0.62, (0, 0, 0.33), glass))
    parts.append(cone(0.36, 0.22, 0.3, (0, 0, 0.17), liquid))
    parts.append(sphere(0.05, (0.08, -0.25, 0.25), mat("test-bubble", WHITE, 0.2, emit=0.6)))
    return group("apex-test", parts)


def ci_runner():
    case = mat("ci-case", NAVY, 0.4, coat=0.4)
    slot = mat("ci-slot", (0.1, 0.1, 0.14), 0.6)
    ok = mat("ci-ok", GREEN, 0.3, emit=1.5)
    busy = mat("ci-busy", BRAND_LIGHT, 0.3, emit=1.5)
    parts = [box((0.7, 0.6, 1.1), (0, 0, 0.55), case, 0.05)]
    for i in range(4):
        z = 0.22 + i * 0.24
        parts.append(box((0.56, 0.04, 0.12), (0, -0.3, z), slot, 0.01))
        parts.append(sphere(0.025, (0.22, -0.33, z), ok if i % 2 == 0 else busy))
    return group("ci-runner", parts)


def rocket():
    body = mat("rocket-body", WHITE, 0.3, coat=0.8)
    nose = mat("rocket-nose", BRAND, 0.3, coat=0.8)
    fin = mat("rocket-fin", BRAND_LIGHT, 0.3)
    window = mat("rocket-window", NAVY, 0.1, coat=1.0)
    flame = mat("rocket-flame", ORANGE, 0.3, emit=2.0)
    parts = [cyl(0.2, 0.7, (0, 0, 0.55), body, vertices=40)]
    parts.append(cone(0.2, 0, 0.32, (0, 0, 1.06), nose, vertices=40))
    parts.append(cyl(0.08, 0.04, (0, -0.19, 0.68), window, (math.radians(90), 0, 0), 24))
    for a in range(3):
        angle = math.radians(a * 120)
        parts.append(box((0.04, 0.22, 0.28), (math.sin(angle) * 0.22, math.cos(angle) * 0.22, 0.3), fin, 0.015, (0, 0, -angle)))
    parts.append(cone(0.14, 0.02, 0.22, (0, 0, 0.1), flame, (math.radians(180), 0, 0)))
    return group("rocket", parts)


def note():
    paper = mat("note-paper", NOTE, 0.6, coat=0.1)
    ink = mat("note-ink", (0.25, 0.2, 0.1), 0.6)
    parts = [box((0.9, 0.04, 0.9), (0, 0, 0.45), paper, 0.02, (0, math.radians(-6), 0))]
    for i, w in enumerate((0.62, 0.7, 0.48)):
        parts.append(box((w, 0.02, 0.04), (-0.05, -0.03, 0.62 - i * 0.16), ink, 0.008, (0, math.radians(-6), 0)))
    parts.append(text("V.", 0.16, (0.25, -0.04, 0.16), ink, 0.01))
    return group("note", parts)


def ticket():
    stub = mat("ticket-stub", PINK, 0.35, coat=0.6)
    white = mat("ticket-white", WHITE, 0.3, emit=0.4)
    pts = []
    for i in range(13):
        a = math.radians(-90 + i * 15)
        pts.append((-0.5 + 0.09 * math.cos(a) * -1 + 0.0, 0.3 * math.sin(a) * 0 + (-0.3 + i * 0.05)))
    outline = [(-0.5, -0.3), (0.5, -0.3), (0.5, -0.08), (0.42, 0.0), (0.5, 0.08), (0.5, 0.3), (-0.5, 0.3), (-0.5, 0.08), (-0.42, 0.0), (-0.5, -0.08)]
    parts = [prism(outline, 0.08, (0, 0.04, 0.32), stub, 0.02)]
    parts.append(text("US-014", 0.16, (0, -0.02, 0.32), white, 0.02))
    return group("ticket", parts)


def svg_item(name, filename, depth, colors):
    """Imports an SVG, extrudes each shape, and keeps its own colours."""
    path = os.path.abspath(os.path.join(IMAGES, filename))
    before = set(bpy.data.objects)
    try:
        bpy.ops.import_curve.svg(filepath=path)
    except AttributeError:
        bpy.ops.preferences.addon_enable(module="io_curve_svg")
        bpy.ops.import_curve.svg(filepath=path)
    curves = [o for o in bpy.data.objects if o not in before and o.type == "CURVE"]
    # Depths are given for a drawing one unit wide: the import's own units differ
    bpy.context.view_layer.update()
    span = max(max(c.dimensions.x, c.dimensions.y) for c in curves)
    depth = depth * span
    parts = []
    for i, c in enumerate(curves):
        # Each later layer of the drawing sits a little in front of the one
        # under it, so the inner marks are not swallowed by the outer shape
        c.data.extrude = depth
        c.data.bevel_depth = depth * 0.15
        c.location.z += i * depth * 1.3
        c.data.bevel_resolution = 1
        c.data.resolution_u = 4
        bpy.ops.object.select_all(action="DESELECT")
        c.select_set(True)
        bpy.context.view_layer.objects.active = c
        bpy.ops.object.convert(target="MESH")
        o = active()
        color = colors[i % len(colors)]
        o.data.materials.clear()
        o.data.materials.append(mat(name + "-" + str(i), color, 0.3, coat=0.9, emit=0.15))
        parts.append(o)
    item = group(name, parts)
    # SVG units are tiny: one unit wide, then stood up facing -Y
    size = max(item.dimensions.x, item.dimensions.y, 1e-6)
    item.scale = (1.0 / size,) * 3
    item.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.select_all(action="DESELECT")
    item.select_set(True)
    bpy.context.view_layer.objects.active = item
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return group(name, [item])


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    items = [
        cloud("org-cloud", BRAND_LIGHT),
        cloud("scratch-cloud", TEAL, 0.8),
        custom_field(),
        permission_set(),
        flow(),
        apex(),
        lwc(),
        record(),
        package_xml(),
        branch(),
        pull_request(),
        check("check-pass", GREEN, "pass"),
        check("check-warn", ORANGE, "warn"),
        check("check-fail", RED, "fail"),
        apex_test(),
        ci_runner(),
        rocket(),
        note(),
        ticket(),
        svg_item("cloudity-logo", "cloudity-logo.svg", 0.07, [(0.0, 0.0, 0.58), (0.0, 0.325, 1.0)]),
        svg_item("sfdx-hardis-badge", "badge-mark.svg", 0.05, [(0.17, 0.07, 0.39), (1.0, 0.72, 0.36), WHITE, (0.565, 0.314, 0.914)]),
    ]
    # Side by side, for the preview and for anyone opening the file
    for i, item in enumerate(items):
        item.location = ((i % 7) * 1.5, (i // 7) * 1.6, 0)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_yup=True, export_apply=True)
    print("exported", OUT, len(items), "items")
    if PREVIEW:
        scene = bpy.context.scene
        engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
        scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
        scene.render.resolution_x, scene.render.resolution_y = 1400, 800
        world = bpy.data.worlds.new("World")
        world.use_nodes = True
        world.node_tree.nodes["Background"].inputs[0].default_value = (0.8, 0.9, 1, 1)
        scene.world = world
        bpy.ops.object.light_add(type="SUN", location=(3, -5, 8))
        active().data.energy = 3.5
        active().rotation_euler = (math.radians(40), math.radians(15), math.radians(25))
        bpy.ops.object.camera_add(location=(4.5, -7.5, 4.2))
        cam = active()
        direction = Vector((4.5, 1.6, 0.4)) - cam.location
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        cam.data.lens = 32
        scene.camera = cam
        scene.render.filepath = PREVIEW
        bpy.ops.render.render(write_still=True)
        print("preview", PREVIEW)


main()
