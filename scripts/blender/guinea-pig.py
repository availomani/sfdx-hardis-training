"""
The guinea pig of Guinea Run, built from code in Blender, rigged and animated,
and exported as one glTF binary the game loads.

    blender --background --factory-startup --python scripts/blender/guinea-pig.py -- \
        site-theme/javascripts/guinea-run/models/guinea-pig.glb [preview.png]

The shape is measured on photos of real guinea pigs (see shape()). The agouti
coat is drawn by a procedural shader and baked into a colour map and a hair
normal map; the rest is flat materials. The model faces -Y in Blender, which
the glTF exporter turns into -Z, the way the game's guinea pig has always
looked down its track. GUINEA_CAMERA="x,y,z" moves the preview camera, to
compare a side or a front view with a photo.

Bones: root, body, head, ear.L, ear.R, leg.FL, leg.FR, leg.BL, leg.BR.
Actions (glTF animations): idle, run, jump, sit, happy, hit.
"""

import math
import os
import sys

import bpy
from mathutils import Euler, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGS[0] if ARGS else "guinea-pig.glb"
PREVIEW = ARGS[1] if len(ARGS) > 1 else None

GINGER = (0.76, 0.42, 0.17)
GINGER_DARK = (0.55, 0.28, 0.1)
WHITE = (0.95, 0.92, 0.87)
BLACK = (0.14, 0.1, 0.08)
PINK = (0.93, 0.62, 0.6)
PINK_DEEP = (0.85, 0.45, 0.47)
FPS = 30


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS


def srgb_to_linear(c):
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def material(name, color, roughness=0.6, metallic=0.0, vertex_colors=False, clearcoat=0.0, sheen=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*srgb_to_linear(color), 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if sheen and "Sheen Weight" in bsdf.inputs:
        bsdf.inputs["Sheen Weight"].default_value = sheen
        bsdf.inputs["Sheen Tint"].default_value = (1, 0.92, 0.85, 1)
    if clearcoat and "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = clearcoat
    if vertex_colors:
        attribute = mat.node_tree.nodes.new("ShaderNodeVertexColor")
        attribute.layer_name = "Coat"
        mat.node_tree.links.new(attribute.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


# The guinea pig of the photos, measured from the side on short-haired ones: a
# long loaf, highest over the hips, a big round rump that drops to the floor, a
# flat belly, and a head with no neck whose forehead runs in a long, almost
# straight slope from the crown behind the ears down to a broad, rounded nose
# well ahead of the eyes, the chin tucked under it. s runs along the body from
# the rump (S_RUMP) to the tip of the nose (S_NOSE). Each curve gives, at s, a
# height above the floor or a half width; the two ends are then rounded off: a
# long round cap on the rump, a short one on the nose.
S_RUMP, S_NOSE = -0.84, 0.94
RUMP_CAP, NOSE_CAP = 0.42, 0.09
AXIS = 0.38  # the height of the flanks, for the coat shading and the rig

# The top line: a round back, then the flat forehead sloping to the nose
TOP = [(-0.84, 0.97), (-0.6, 1.0), (-0.3, 1.01), (0.0, 0.99), (0.25, 0.95), (0.44, 0.9), (0.6, 0.81), (0.75, 0.72), (0.88, 0.63), (0.94, 0.58)]
# The bottom line: a flat belly, then the throat and the chin rising to the nose
BOTTOM = [(-0.84, 0.12), (-0.62, 0.04), (-0.3, 0.03), (0.2, 0.03), (0.42, 0.05), (0.56, 0.1), (0.68, 0.18), (0.8, 0.29), (0.9, 0.38), (0.94, 0.42)]
# The half width: broad hips, full cheeks, then a muzzle that narrows to the nose
HALF = [(-0.84, 0.62), (-0.5, 0.61), (-0.2, 0.6), (0.1, 0.57), (0.35, 0.5), (0.5, 0.45), (0.66, 0.38), (0.8, 0.28), (0.9, 0.19), (0.94, 0.15)]


def curve(points, s):
    """Catmull-Rom through (s, value) points, flat beyond the first and the last."""
    if s <= points[0][0]:
        return points[0][1]
    if s >= points[-1][0]:
        return points[-1][1]
    for i in range(len(points) - 1):
        if points[i][0] <= s <= points[i + 1][0]:
            p0 = points[max(i - 1, 0)][1]
            p1 = points[i][1]
            p2 = points[i + 1][1]
            p3 = points[min(i + 2, len(points) - 1)][1]
            t = (s - points[i][0]) / (points[i + 1][0] - points[i][0])
            return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
    return points[-1][1]


def smooth(edge0, edge1, x):
    t = min(max((x - edge0) / (edge1 - edge0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def middle(s):
    """The height where the cross-section is widest: low on the body, halfway up the head."""
    bottom = curve(BOTTOM, s)
    return bottom + (0.42 + 0.08 * smooth(0.3, 0.7, s)) * (curve(TOP, s) - bottom)


def cap(s):
    """1 along the body, falling to 0 at the two ends: a round rump, a rounded nose."""
    rump = min(max((s - S_RUMP) / RUMP_CAP, 0.0), 1.0)
    nose = min(max((S_NOSE - s) / NOSE_CAP, 0.0), 1.0)
    return math.sqrt(1 - (1 - rump) ** 2) * math.sqrt(1 - (1 - nose) ** 2)


def shape(s, dx, dy):
    """The point of the body at s, in the direction (dx, dy) of its cross-section."""
    rho = cap(s)
    # A loaf, not a tube: the body's cross-section is squarer than a circle,
    # most of all under the flanks; the head stays round
    loaf = 1 - smooth(0.3, 0.75, s)
    e = 2 / (2 + (0.8 if dy < 0 else 0.35) * loaf)
    sx, sy = math.copysign(abs(dx) ** e, dx), math.copysign(abs(dy) ** e, dy)
    X = sx * rho * curve(HALF, s)
    # Full flanks that bulge before they turn under the belly, and full cheeks
    X *= 1 + 0.04 * (1 - smooth(0.0, 0.65, abs(sy + 0.2))) * loaf
    X *= 1 + 0.08 * smooth(0.35, 0.5, s) * (1 - smooth(0.62, 0.78, s))
    mid = middle(s)
    Z = mid + sy * rho * ((curve(TOP, s) - mid) if sy > 0 else (mid - curve(BOTTOM, s)))
    return Vector((X, -s, Z))


def body_mesh():
    """A dense sphere wrapped onto the shape: z along the body, x and y around it."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=1)
    mesh = bpy.context.view_layer.objects.active
    mesh.name = "Body"
    for v in mesh.data.vertices:
        x, y, z = v.co
        s = S_RUMP + (z + 1) / 2 * (S_NOSE - S_RUMP)
        ring = math.hypot(x, y)
        dx, dy = (x / ring, y / ring) if ring > 1e-6 else (0.0, 0.0)
        v.co = shape(s, dx, dy)
    bpy.ops.object.shade_smooth()
    return mesh


def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def band(value, low, high, soft):
    """1 inside [low, high], fading to 0 over soft on both sides."""
    return smooth(low - soft, low + soft, value) * (1 - smooth(high - soft, high + soft, value))


def blob(distance, soft=0.25):
    """1 at the centre of an ellipse (distance 0), 0 outside (distance 1), soft edge."""
    return 1 - smooth(1 - soft, 1 + soft * 0.5, distance)


def coat_material(body):
    """
    The short-haired agouti coat of the guinea pig of the course: every hair
    ticked dark brown, grey and tan, a darker back, a creamy belly and chin, a
    warm tan ring round the eyes. Drawn by a procedural shader, then baked into
    a colour map and a hair normal map, so the game pays two textures for it.
    """
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8
    work = bpy.data.materials.new("CoatBake")
    work.use_nodes = True
    nodes = work.node_tree.nodes
    links = work.node_tree.links
    bsdf = nodes["Principled BSDF"]
    coords = nodes.new("ShaderNodeTexCoord")

    def node(kind, **inputs):
        n = nodes.new(kind)
        for key, value in inputs.items():
            n.inputs[key].default_value = value
        return n

    def ramp(fac, stops):
        r = nodes.new("ShaderNodeValToRGB")
        r.color_ramp.elements[0].position, r.color_ramp.elements[0].color = stops[0][0], (*srgb_to_linear(stops[0][1]), 1)
        r.color_ramp.elements[1].position, r.color_ramp.elements[1].color = stops[-1][0], (*srgb_to_linear(stops[-1][1]), 1)
        for position, color in stops[1:-1]:
            e = r.color_ramp.elements.new(position)
            e.color = (*srgb_to_linear(color), 1)
        links.new(fac, r.inputs["Fac"])
        return r.outputs["Color"]

    def mix(a, b, factor):
        m = nodes.new("ShaderNodeMix")
        m.data_type = "RGBA"
        links.new(factor, m.inputs["Factor"])
        if isinstance(a, tuple):
            m.inputs["A"].default_value = (*srgb_to_linear(a), 1)
        else:
            links.new(a, m.inputs["A"])
        if isinstance(b, tuple):
            m.inputs["B"].default_value = (*srgb_to_linear(b), 1)
        else:
            links.new(b, m.inputs["B"])
        return m.outputs["Result"]

    def remap(value, low, high):
        r = node("ShaderNodeMapRange", **{"From Min": low, "From Max": high})
        r.clamp = True
        links.new(value, r.inputs["Value"])
        return r.outputs["Result"]

    xyz = nodes.new("ShaderNodeSeparateXYZ")
    links.new(coords.outputs["Object"], xyz.inputs["Vector"])
    # Ticking: fine noise, stretched along the body as hair lies
    stretch = node("ShaderNodeVectorMath")
    stretch.operation = "MULTIPLY"
    stretch.inputs[1].default_value = (1.0, 0.45, 1.0)
    links.new(coords.outputs["Object"], stretch.inputs[0])
    fine = node("ShaderNodeTexNoise", Scale=140.0, Detail=6.0, Roughness=0.65)
    links.new(stretch.outputs["Vector"], fine.inputs["Vector"])
    ticked = ramp(fine.outputs["Fac"], [
        (0.32, (0.12, 0.085, 0.06)),
        (0.46, (0.27, 0.2, 0.15)),
        (0.58, (0.4, 0.31, 0.23)),
        (0.7, (0.55, 0.44, 0.32)),
    ])
    # Broad patches: a little lighter and warmer in places, as in the photo
    broad = node("ShaderNodeTexNoise", Scale=4.0, Detail=2.0)
    links.new(coords.outputs["Object"], broad.inputs["Vector"])
    coat = mix(ticked, (0.46, 0.35, 0.25), remap(broad.outputs["Fac"], 0.55, 0.8))
    # Darker along the back, creamy under the belly and the chin
    coat = mix(coat, (0.24, 0.19, 0.15), remap(xyz.outputs["Z"], AXIS + 0.22, AXIS + 0.46))
    coat = mix(coat, (0.78, 0.68, 0.53), remap(xyz.outputs["Z"], AXIS - 0.08, AXIS - 0.24))
    chin = node("ShaderNodeMath")
    chin.operation = "MULTIPLY"
    links.new(remap(xyz.outputs["Y"], -0.6, -0.74), chin.inputs[0])
    links.new(remap(xyz.outputs["Z"], AXIS + 0.02, AXIS - 0.1), chin.inputs[1])
    coat = mix(coat, (0.74, 0.63, 0.5), chin.outputs["Value"])
    # A lighter, warmer muzzle round the nose, as on the photos
    muzzle = node("ShaderNodeVectorMath")
    muzzle.operation = "DISTANCE"
    links.new(coords.outputs["Object"], muzzle.inputs[0])
    muzzle.inputs[1].default_value = (0.0, -S_NOSE, middle(S_NOSE) - 0.04)
    coat = mix(coat, (0.66, 0.54, 0.41), remap(muzzle.outputs["Value"], 0.26, 0.13))
    # The warm tan ring round each eye
    # Mirrored on X only: both eyes, and nothing on the rump
    side = node("ShaderNodeMath")
    side.operation = "ABSOLUTE"
    links.new(xyz.outputs["X"], side.inputs[0])
    mirrored = nodes.new("ShaderNodeCombineXYZ")
    links.new(side.outputs["Value"], mirrored.inputs["X"])
    links.new(xyz.outputs["Y"], mirrored.inputs["Y"])
    links.new(xyz.outputs["Z"], mirrored.inputs["Z"])
    eye = node("ShaderNodeVectorMath")
    eye.operation = "DISTANCE"
    links.new(mirrored.outputs["Vector"], eye.inputs[0])
    eye.inputs[1].default_value = (EYE.x, EYE.y, EYE.z)
    coat = mix(coat, (0.52, 0.38, 0.26), remap(eye.outputs["Value"], 0.085, 0.055))
    links.new(coat, bsdf.inputs["Base Color"])
    # Hair grain, for the normal map
    hair = node("ShaderNodeTexNoise", Scale=320.0, Detail=3.0)
    grain = node("ShaderNodeVectorMath")
    grain.operation = "MULTIPLY"
    grain.inputs[1].default_value = (1.0, 0.2, 1.0)
    links.new(coords.outputs["Object"], grain.inputs[0])
    links.new(grain.outputs["Vector"], hair.inputs["Vector"])
    bump = node("ShaderNodeBump", Strength=0.35, Distance=0.004)
    links.new(hair.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    body.data.materials.clear()
    body.data.materials.append(work)
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body

    def bake(name, kind, color_space, **options):
        image = bpy.data.images.new(name, 1024, 1024)
        image.colorspace_settings.name = color_space
        target = nodes.new("ShaderNodeTexImage")
        target.image = image
        for n in nodes:
            n.select = False
        target.select = True
        nodes.active = target
        bpy.ops.object.bake(type=kind, margin=8, **options)
        image.pack()
        nodes.remove(target)
        return image

    color = bake("CoatColor", "DIFFUSE", "sRGB", pass_filter={"COLOR"})
    normal = bake("CoatNormal", "NORMAL", "Non-Color", normal_space="TANGENT")

    # What the game gets: the two baked maps, a fur roughness and a sheen
    final = bpy.data.materials.new("Coat")
    final.use_nodes = True
    fn = final.node_tree.nodes
    fl = final.node_tree.links
    fb = fn["Principled BSDF"]
    image_color = fn.new("ShaderNodeTexImage")
    image_color.image = color
    image_normal = fn.new("ShaderNodeTexImage")
    image_normal.image = normal
    normal_map = fn.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.8
    fl.new(image_color.outputs["Color"], fb.inputs["Base Color"])
    fl.new(image_normal.outputs["Color"], normal_map.inputs["Color"])
    fl.new(normal_map.outputs["Normal"], fb.inputs["Normal"])
    fb.inputs["Roughness"].default_value = 0.82
    if "Sheen Weight" in fb.inputs:
        fb.inputs["Sheen Weight"].default_value = 0.2
        fb.inputs["Sheen Tint"].default_value = (1, 0.95, 0.9, 1)
    body.data.materials.clear()
    body.data.materials.append(final)
    bpy.data.materials.remove(work)


def add(primitive, name, location, scale=(1, 1, 1), rotation=(0, 0, 0), mat=None, **kwargs):
    getattr(bpy.ops.mesh, "primitive_" + primitive + "_add")(location=location, rotation=rotation, **kwargs)
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if mat:
        obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def surface(s, side, t):
    """A point on the body at s, on one side, t from -1 (under it) to 1 (on top)."""
    return shape(s, side * math.sqrt(max(1 - t * t, 0)), t)


EYE = Vector((0.0, 0.0, 0.0))


def details(mats):
    parts = []
    # Eyes: big, round, glossy dark brown, with a large and a small highlight
    for side in (1, -1):
        p = surface(0.66, side, 0.35)
        tag = "R" if side > 0 else "L"
        parts.append(add("uv_sphere", "Eye" + tag, (p.x * 0.93, p.y, p.z), (0.055, 0.068, 0.068), mat=mats["eye"], segments=24, ring_count=14))
        parts.append(add("uv_sphere", "Eye" + tag + "Shine", (p.x * 1.03, p.y - 0.025, p.z + 0.028), (0.016, 0.016, 0.016), mat=mats["shine"], segments=12, ring_count=8))
        parts.append(add("uv_sphere", "Eye" + tag + "Glint", (p.x * 1.035, p.y + 0.02, p.z - 0.02), (0.008, 0.008, 0.008), mat=mats["shine"], segments=8, ring_count=6))
    # Ears: soft grey-pink petals that lie on the top corners of the head and
    # fold over its edge, hanging down the sides, their tips a little back
    for side in (1, -1):
        root = surface(0.44, side, 0.7)
        tilt = Euler((math.radians(-8), math.radians(54 * side), math.radians(-14 * side)))
        turn = tilt.to_matrix()
        out = turn @ Vector((side, 0, 0))
        normal = turn @ Vector((0, 0, 1))
        # The guinea pig faces -Y: its left ear is on +X, like the ear.L bone
        tag = "L" if side > 0 else "R"
        at = root + out * 0.115 + normal * 0.012
        parts.append(add("uv_sphere", "Ear" + tag, tuple(at), (0.12, 0.085, 0.013), tuple(tilt), mat=mats["earOuter"], segments=20, ring_count=12))
        inner = at - normal * 0.007
        parts.append(add("uv_sphere", "Ear" + tag + "In", tuple(inner), (0.098, 0.066, 0.008), tuple(tilt), mat=mats["ear"], segments=16, ring_count=10))
    # Nose: a soft dark pad with two nostrils, and the split lip under it
    tip = surface(S_NOSE, 1, 0.0)
    nose_at = (0, tip.y + 0.012, tip.z + 0.02)
    parts.append(add("uv_sphere", "Nose", nose_at, (0.055, 0.03, 0.04), mat=mats["nose"], segments=14, ring_count=8))
    for side in (1, -1):
        parts.append(add("uv_sphere", "Nostril", (side * 0.018, nose_at[1] - 0.022, nose_at[2] + 0.004), (0.009, 0.006, 0.006), mat=mats["mouth"], segments=8, ring_count=6))
    parts.append(add("cylinder", "Mouth", (0, nose_at[1] + 0.004, nose_at[2] - 0.04), (0.0035, 0.0035, 0.022), mat=mats["mouth"], vertices=6))
    for side in (1, -1):
        lip = add("cylinder", "Mouth", (side * 0.014, nose_at[1] + 0.008, nose_at[2] - 0.062), (0.003, 0.003, 0.016), (0, math.radians(55 * side), 0), mat=mats["mouth"], vertices=6)
        parts.append(lip)
    # Feet: grey-pink pads with small toes and dark claws
    for name, (x, s) in {"FootFL": (0.2, 0.42), "FootFR": (-0.2, 0.42), "FootBL": (0.25, -0.5), "FootBR": (-0.25, -0.5)}.items():
        parts.append(add("uv_sphere", name, (x, -s, 0.032), (0.06, 0.085, 0.034), mat=mats["foot"], segments=14, ring_count=8))
        toes = 4 if s > 0 else 3
        for i in range(toes):
            dx = (i - (toes - 1) / 2) * 0.03
            parts.append(add("uv_sphere", name + "Toe", (x + dx, -s - 0.075, 0.022), (0.016, 0.02, 0.016), mat=mats["foot"], segments=8, ring_count=6))
            parts.append(add("uv_sphere", name + "Claw", (x + dx, -s - 0.094, 0.016), (0.007, 0.012, 0.006), mat=mats["claw"], segments=6, ring_count=4))
    # Whiskers: long, fine, four a side, from the muzzle outwards
    for side in (1, -1):
        root = surface(0.86, side, -0.15)
        for i in range(4):
            angle = math.radians(-18 + i * 12)
            length = 0.3
            direction = Vector((side * math.cos(angle), -0.3, math.sin(angle) * 0.7)).normalized()
            centre = root + direction * (length / 2)
            whisker = add("cylinder", "Whisker", centre, (0.0025, 0.0025, length / 2), mat=mats["whisker"], vertices=5)
            whisker.rotation_mode = "QUATERNION"
            whisker.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
            parts.append(whisker)
    return parts


def armature():
    data = bpy.data.armatures.new("Rig")
    rig = bpy.data.objects.new("Rig", data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    bones = {}

    def bone(name, head, tail, parent=None):
        b = data.edit_bones.new(name)
        b.head, b.tail = head, tail
        if parent:
            b.parent = bones[parent]
        bones[name] = b

    bone("root", (0, 0, 0), (0, 0, 0.12))
    bone("body", (0, 0.62, AXIS), (0, -0.3, AXIS), "root")
    bone("head", (0, -0.3, AXIS), (0, -0.8, AXIS - 0.05), "body")
    bone("ear.L", (0.2, -0.42, 0.68), (0.23, -0.38, 0.8), "head")
    bone("ear.R", (-0.2, -0.42, 0.68), (-0.23, -0.38, 0.8), "head")
    bone("leg.FL", (0.2, -0.42, 0.22), (0.2, -0.42, 0.0), "body")
    bone("leg.FR", (-0.2, -0.42, 0.22), (-0.2, -0.42, 0.0), "body")
    bone("leg.BL", (0.25, 0.5, 0.22), (0.25, 0.5, 0.0), "body")
    bone("leg.BR", (-0.25, 0.5, 0.22), (-0.25, 0.5, 0.0), "body")
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def bind(rig, body, parts):
    """The body gets automatic weights; each small part follows one bone."""
    follow = {
        "Eye": "head", "Shine": "head", "Nose": "head", "Nostril": "head", "Mouth": "head", "Whisker": "head",
        "EarR": "ear.R", "EarL": "ear.L",
        "FootFL": "leg.FL", "FootFR": "leg.FR", "FootBL": "leg.BL", "FootBR": "leg.BR",
    }
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    for part in parts:
        key = next((k for k in follow if part.name.startswith(k)), None)
        group = part.vertex_groups.new(name=follow[key])
        group.add([v.index for v in part.data.vertices], 1.0, "REPLACE")
        modifier = part.modifiers.new("Rig", "ARMATURE")
        modifier.object = rig
        part.parent = rig


def keys(rig, action_name, frames, length, loop=True):
    """frames: {frame: {bone: (location, rotation_euler_degrees, scale)}}"""
    action = bpy.data.actions.new(action_name)
    rig.animation_data_create()
    rig.animation_data.action = action
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    for frame, pose in sorted(frames.items()):
        for name, (loc, rot, scale) in pose.items():
            pb = rig.pose.bones[name]
            pb.location = loc
            pb.rotation_euler = [math.radians(a) for a in rot]
            pb.scale = scale
            pb.keyframe_insert("location", frame=frame)
            pb.keyframe_insert("rotation_euler", frame=frame)
            pb.keyframe_insert("scale", frame=frame)
    action.frame_range = (0, length)
    action.use_frame_range = True
    # Park it on the NLA, so the exporter writes one animation per action
    track = rig.animation_data.nla_tracks.new()
    track.name = action_name
    strip = track.strips.new(action_name, 0, action)
    strip.name = action_name
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    return action


Z = (0, 0, 0)
ONE = (1, 1, 1)


def pose(**bones):
    return {name: (value[0], value[1], value[2] if len(value) > 2 else ONE) for name, value in bones.items()}


def animations(rig):
    # Bone-local axes: Blender bones point along their Y. For "body" (pointing
    # forward) a rotation round X nods the whole body; for legs round X swings them.
    keys(rig, "idle", {
        0: pose(body=(Z, Z, ONE), head=(Z, Z), **{"ear.L": (Z, Z), "ear.R": (Z, Z)}),
        30: pose(body=(Z, Z, (1.03, 1.0, 1.03)), head=(Z, (4, 0, 0)), **{"ear.L": (Z, (0, 0, 12)), "ear.R": (Z, Z)}),
        45: pose(body=(Z, Z, ONE), head=(Z, (0, 0, -6)), **{"ear.L": (Z, Z), "ear.R": (Z, (0, 0, -10))}),
        60: pose(body=(Z, Z, ONE), head=(Z, Z), **{"ear.L": (Z, Z), "ear.R": (Z, Z)}),
    }, 60)
    # A gallop: back legs push together, front legs land together, the body
    # stretches and gathers, and bobs
    keys(rig, "run", {
        0: pose(root=(Z, Z), body=((0, 0, 0), (6, 0, 0), (1, 1.06, 0.97)), head=(Z, (-6, 0, 0)),
                **{"leg.FL": (Z, (-45, 0, 0)), "leg.FR": (Z, (-40, 0, 0)), "leg.BL": (Z, (40, 0, 0)), "leg.BR": (Z, (45, 0, 0)), "ear.L": (Z, (-15, 0, 0)), "ear.R": (Z, (-15, 0, 0))}),
        5: pose(root=((0, 0, 0.09), Z), body=((0, 0, 0), (-4, 0, 0), (1, 0.94, 1.04)), head=(Z, (4, 0, 0)),
                **{"leg.FL": (Z, (35, 0, 0)), "leg.FR": (Z, (30, 0, 0)), "leg.BL": (Z, (-35, 0, 0)), "leg.BR": (Z, (-30, 0, 0)), "ear.L": (Z, (10, 0, 0)), "ear.R": (Z, (10, 0, 0))}),
        10: pose(root=(Z, Z), body=((0, 0, 0), (6, 0, 0), (1, 1.06, 0.97)), head=(Z, (-6, 0, 0)),
                 **{"leg.FL": (Z, (-45, 0, 0)), "leg.FR": (Z, (-40, 0, 0)), "leg.BL": (Z, (40, 0, 0)), "leg.BR": (Z, (45, 0, 0)), "ear.L": (Z, (-15, 0, 0)), "ear.R": (Z, (-15, 0, 0))}),
    }, 10)
    # In the air: stretched long, legs tucked
    keys(rig, "jump", {
        0: pose(body=(Z, (-10, 0, 0), (0.95, 1.12, 0.95)), head=(Z, (8, 0, 0)),
                **{"leg.FL": (Z, (-50, 0, 0)), "leg.FR": (Z, (-50, 0, 0)), "leg.BL": (Z, (50, 0, 0)), "leg.BR": (Z, (50, 0, 0)), "ear.L": (Z, (-30, 0, 0)), "ear.R": (Z, (-30, 0, 0))}),
        12: pose(body=(Z, (6, 0, 0), (1.02, 1.04, 0.98)), head=(Z, (-4, 0, 0)),
                 **{"leg.FL": (Z, (20, 0, 0)), "leg.FR": (Z, (20, 0, 0)), "leg.BL": (Z, (-15, 0, 0)), "leg.BR": (Z, (-15, 0, 0)), "ear.L": (Z, (20, 0, 0)), "ear.R": (Z, (20, 0, 0))}),
    }, 12, loop=False)
    # Up on its back legs, nose high, front paws off the ground
    keys(rig, "sit", {
        0: pose(root=((0, 0, -0.08), Z), body=((0, 0, 0.0), (28, 0, 0)), head=(Z, (-12, 0, 0)),
                **{"leg.FL": (Z, (-30, 0, 0)), "leg.FR": (Z, (-30, 0, 0)), "leg.BL": (Z, (-28, 0, 0)), "leg.BR": (Z, (-28, 0, 0))}),
        40: pose(root=((0, 0, -0.08), Z), body=((0, 0, 0.01), (30, 0, 0), (1.02, 1, 1.02)), head=(Z, (-16, 0, 4)),
                 **{"leg.FL": (Z, (-36, 0, 0)), "leg.FR": (Z, (-26, 0, 0)), "leg.BL": (Z, (-28, 0, 0)), "leg.BR": (Z, (-28, 0, 0))}),
        80: pose(root=((0, 0, -0.08), Z), body=((0, 0, 0.0), (28, 0, 0)), head=(Z, (-12, 0, 0)),
                 **{"leg.FL": (Z, (-30, 0, 0)), "leg.FR": (Z, (-30, 0, 0)), "leg.BL": (Z, (-28, 0, 0)), "leg.BR": (Z, (-28, 0, 0))}),
    }, 80)
    # Popcorning: the happy hop of a guinea pig, with a twist in the air
    keys(rig, "happy", {
        0: pose(root=(Z, Z), body=(Z, Z, (1.06, 0.95, 0.9))),
        6: pose(root=((0, 0, 0.45), (0, 0, 25)), body=(Z, (-8, 10, 0), (0.95, 1.08, 1.06)),
                **{"leg.FL": (Z, (-30, 0, 0)), "leg.FR": (Z, (-30, 0, 0)), "leg.BL": (Z, (40, 0, 0)), "leg.BR": (Z, (40, 0, 0)), "ear.L": (Z, (-30, 0, 20)), "ear.R": (Z, (-30, 0, -20))}),
        12: pose(root=((0, 0, 0.3), (0, 0, -20)), body=(Z, (6, -10, 0))),
        18: pose(root=(Z, Z), body=(Z, Z, (1.08, 0.94, 0.88))),
        24: pose(root=(Z, Z), body=(Z, Z, ONE)),
    }, 24, loop=False)
    # Hit: squashed, shaken, ears back
    keys(rig, "hit", {
        0: pose(body=(Z, Z, (1.15, 0.9, 0.8)), head=(Z, (10, 0, 0)), **{"ear.L": (Z, (-40, 0, 0)), "ear.R": (Z, (-40, 0, 0))}),
        4: pose(body=(Z, (0, 12, 0), (0.95, 1.05, 1.05))),
        8: pose(body=(Z, (0, -10, 0), (1.04, 0.98, 0.97))),
        12: pose(body=(Z, (0, 5, 0), ONE)),
        16: pose(body=(Z, Z, ONE), head=(Z, Z), **{"ear.L": (Z, Z), "ear.R": (Z, Z)}),
    }, 16, loop=False)


def preview(path):
    """A quick studio render, to look at the model without the game, at rest."""
    scene = bpy.context.scene
    # Every action sits on the NLA and they would all play at once: mute them
    for obj in scene.objects:
        if obj.animation_data:
            for track in obj.animation_data.nla_tracks:
                track.mute = True
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
    # GUINEA_PORTRAIT=1: the picture of the game's cards and the site footer,
    # on a transparent background with no floor
    portrait = os.environ.get("GUINEA_PORTRAIT") == "1"
    scene.render.resolution_x, scene.render.resolution_y = (900, 600) if portrait else (960, 640)
    scene.render.film_transparent = portrait
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.88, 1, 1)
    scene.world = world
    bpy.ops.object.light_add(type="SUN", location=(3, -3, 5))
    sun = bpy.context.view_layer.objects.active
    sun.data.energy = 4
    sun.rotation_euler = (math.radians(45), math.radians(10), math.radians(35))
    if portrait:
        # A soft key light from the camera's side, so the face is not in shadow
        bpy.ops.object.light_add(type="SUN", location=(-3, -3, 4))
        key = bpy.context.view_layer.objects.active
        key.data.energy = 3
        key.rotation_euler = (Vector((0, 0, 0.4)) - key.location).to_track_quat("-Z", "Y").to_euler()
    else:
        bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
        floor = bpy.context.view_layer.objects.active
        floor.data.materials.append(material("Floor", (0.8, 0.9, 0.95), 0.9))
    # GUINEA_CAMERA="x,y,z" moves the camera, to compare a side or front view with a photo
    eye = tuple(float(v) for v in os.environ.get("GUINEA_CAMERA", "2.1,-2.3,1.25").split(","))
    bpy.ops.object.camera_add(location=eye)
    camera = bpy.context.view_layer.objects.active
    direction = Vector((0, -0.1, 0.36)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 50
    scene.camera = camera
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    reset()
    mats = {
        "eye": material("Eye", (0.07, 0.04, 0.03), 0.04, clearcoat=1.0),
        "shine": material("Shine", (1, 1, 1), 0.15),
        "ear": material("Ear", (0.84, 0.66, 0.66), 0.7),
        "earOuter": material("EarOuter", (0.42, 0.33, 0.27), 0.8),
        "nose": material("Nose", (0.5, 0.36, 0.34), 0.45),
        "mouth": material("Mouth", (0.2, 0.13, 0.12), 0.6),
        "foot": material("Foot", (0.64, 0.53, 0.5), 0.7),
        "claw": material("Claw", (0.25, 0.2, 0.18), 0.4),
        "whisker": material("Whisker", (0.85, 0.83, 0.8), 0.5),
    }
    body = body_mesh()
    EYE.xyz = surface(0.66, 1, 0.35)
    parts = details(mats)
    coat_material(body)
    rig = armature()
    bind(rig, body, parts)
    animations(rig)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_skins=True,
        export_apply=False,
        export_yup=True,
        export_image_format="WEBP",
        export_image_quality=85,
    )
    print("exported", OUT)
    if PREVIEW:
        preview(PREVIEW)
        print("preview", PREVIEW)


main()
