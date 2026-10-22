"""
The Data Cloud rabbit, the giant boss of Guinea Run, built from code in Blender
after the Data Cloud logo.

    blender --background --factory-startup --python scripts/blender/data-cloud.py -- \
        site-theme/javascripts/guinea-run/models/data-cloud.glb [preview-dir]

The head is the logo in 3D, its outline and ears measured on the picture row by
row: a white gumdrop with a thick dark outline, two long ears with a lavender
inside, small wide-set eyes and a lavender nose. Under it a small round body
with two paws sits on a little cloud.

The outline is an inverted hull: a copy of each part pushed out along its
normals, faces turned inside out, in a material with back faces culled, so only
its rim shows. A hull draws no line where two parts meet, so the root of each
ear is dark up to where it clears the head outline, and a flat dark collar lies
under the head and under the body: seen from the front, the outline runs on
unbroken as on the logo.

The rabbit stands on the floor and is centred, the head one unit wide. It faces
-Y here, +Z once exported, and +X is its left. The game animates these nodes,
each one turns and scales around its own origin:

    data-cloud                    the whole rabbit
      data-cloud-cloud            the cloud, origin at its bottom centre
      data-cloud-body             the body and its collar, origin at its bottom centre
      data-cloud-paw-l, -paw-r    the paws, origin at the shoulder
      data-cloud-head             head, nose and collar, origin at the neck (bottom centre of the head)
        data-cloud-ear-l, -ear-r  the ears, origin at their root on the top of the head
        data-cloud-eye-l, -eye-r  the eyes, origin at their centre: scale them to blink

With a preview directory, it also renders rabbit-front.png (orthographic, on the
background colour of the logo, 260 px a unit) and rabbit-34.png (three-quarter
view from the front-left) there.
"""

import bisect
import json
import math
import os
import struct
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGS[0] if ARGS else "data-cloud.glb"
PREVIEW_DIR = ARGS[1] if len(ARGS) > 1 else None


def hex_color(value):
    return tuple(int(value[i:i + 2], 16) / 255 for i in (1, 3, 5))


# The colours of the logo
NAVY = hex_color("#1F1646")      # outline and eyes
LAVENDER = hex_color("#7473B5")  # inside of the ears, nose
WHITE = hex_color("#FFFFFF")
CLOUD = hex_color("#E6E9FD")
SKY = hex_color("#BEC7F6")       # background of the logo, for the previews only

# The logo is 640x360 px, the head centred on x 320 and 130 px wide: 130 px make one unit
PX = 130.0
# Width of the white head, row by row on the logo (row, px), from its top down
HEAD_ROWS = [
    (134, 40), (137, 54), (140, 64), (143, 73), (146, 80), (149, 87), (152, 92), (155, 99),
    (158, 103), (161, 107), (164, 111), (167, 115), (170, 117), (173, 120), (176, 123),
    (179, 125), (182, 126), (185, 127), (188, 129), (191, 129), (194, 129), (197, 128),
    (200, 128), (203, 127), (206, 125), (209, 122), (212, 119), (215, 113), (218, 107),
    (221, 99), (224, 89), (227, 76), (230, 53),
]
HEAD_TOP_ROW, HEAD_BOTTOM_ROW = 130.3, 232.6
HEAD_HEIGHT = (HEAD_BOTTOM_ROW - HEAD_TOP_ROW) / PX
HEAD_DEPTH = 0.75  # depth over width: round, a bit flatter than a ball
OUTLINE = 0.115    # the dark rim of the logo is 15 px thick

# The lavender inside of the ears, row by row on the logo: row, first and last
# px of the right ear (the rabbit's left, +X), then of the left one. The two are
# drawn a little differently, the model takes their average.
EAR_ROWS = [
    (52, 378, 396, 238, 251), (58, 368, 405, 232, 261), (64, 362, 409, 229, 267),
    (70, 358, 410, 229, 272), (76, 355, 409, 229, 276), (82, 353, 400, 232, 280),
    (88, 351, 378, 237, 283), (94, 350, 374, 248, 285), (100, 349, 371, 260, 287),
    (106, 348, 367, 268, 289), (112, 347, 364, 273, 291), (118, 346, 360, 278, 293),
]
EAR_TOP_ROW = 50.5
EAR_FOLD = (82, 100)   # rows where the tip of the right ear is folded over
EAR_ROOT = 0.70        # how low the ear goes into the head, z up from the bottom of the head
EAR_THICKNESS = 0.06   # half of it, where the ear is widest
EAR_Y = 0.03           # a little behind the middle of the head
EAR_TILT = 8           # degrees back

EYE_X, EYE_Z = 34 / PX, (HEAD_BOTTOM_ROW - 187.5) / PX
EYE_SIZE = (8 / PX, 11.5 / PX)   # half width, half height: 16 x 23 px
NOSE_Z = (HEAD_BOTTOM_ROW - 202.5) / PX
NOSE_SIZE = (10 / PX, 7.25 / PX)  # 20 x 14.5 px

BODY = (0.29, 0.26, 0.31)  # half-axes: about 0.55 of the head wide
BODY_Y = 0.05              # a little back, under the head
CLEARANCE = 0.06           # between the body and the head or the cloud, inside the collars
# The puffs of the cloud: centre x, y, z and half-axes x, y, z, all resting on
# the floor. The body sits on the middle one, the two side ones rise beside it.
PUFFS = [
    (0.0, 0.04, 0.18, 0.33, 0.3, 0.18),
    (-0.41, 0.02, 0.22, 0.23, 0.25, 0.22),
    (0.41, 0.02, 0.22, 0.23, 0.25, 0.22),
    (-0.6, 0.0, 0.13, 0.11, 0.17, 0.13),
    (0.6, 0.0, 0.13, 0.11, 0.17, 0.13),
    (0.0, -0.2, 0.15, 0.27, 0.17, 0.15),
    (0.0, 0.28, 0.18, 0.3, 0.18, 0.18),
]


def srgb(c):
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


MATS = {}


def mat(name, color, roughness, flat=False):
    m = bpy.data.materials.new(name)
    if m.node_tree is None:
        m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(color), 1)
    b.inputs["Roughness"].default_value = roughness
    if flat:
        # One even colour whatever the light, as the outline of the logo is:
        # black under the lights, the colour itself emitted
        b.inputs["Base Color"].default_value = (0, 0, 0, 1)
        b.inputs["Emission Color"].default_value = (*srgb(color), 1)
        b.inputs["Emission Strength"].default_value = 1.0
    # Every part is closed: single-sided everywhere, which the outline needs
    m.use_backface_culling = True
    if hasattr(m, "use_backface_culling_shadow"):
        m.use_backface_culling_shadow = True
    MATS[name] = m
    return m


def materials():
    mat("data-cloud-white", WHITE, 0.5)
    mat("data-cloud-outline", NAVY, 1.0, flat=True)
    mat("data-cloud-lavender", LAVENDER, 0.5)
    mat("data-cloud-eye", NAVY, 0.15)
    mat("data-cloud-cloud", CLOUD, 0.6)


# ---------- The head and the ears, from the logo ----------

def head_profile():
    """The side of the head, from its bottom to its top, as (half-width, z) points close together."""
    zc = HEAD_HEIGHT / 2
    polar = [(0.0, HEAD_HEIGHT - zc)]
    for row, width in HEAD_ROWS:
        # +1 px for the anti-aliased edge of the logo
        z, h = (HEAD_BOTTOM_ROW - row) / PX, (width + 1) / (2 * PX)
        polar.append((math.atan2(h, z - zc), math.hypot(h, z - zc)))
    polar.append((math.pi, zc))
    # Polar around the middle of the head, so the top and the bottom close round
    angles = [a for a, _ in polar]
    radii = [r for _, r in polar]
    # Rows are whole pixels: smooth the radii a little so the surface does not ripple
    radii = radii[:1] + [(radii[i - 1] + 2 * radii[i] + radii[i + 1]) / 4 for i in range(1, len(radii) - 1)] + radii[-1:]
    slopes = [0.0] + [(radii[i + 1] - radii[i - 1]) / (angles[i + 1] - angles[i - 1]) for i in range(1, len(radii) - 1)] + [0.0]
    points = []
    for i in range(len(angles) - 1):
        span = angles[i + 1] - angles[i]
        for k in range(16):
            u = k / 16
            r = ((2 * u ** 3 - 3 * u ** 2 + 1) * radii[i] + (u ** 3 - 2 * u ** 2 + u) * span * slopes[i]
                 + (-2 * u ** 3 + 3 * u ** 2) * radii[i + 1] + (u ** 3 - u ** 2) * span * slopes[i + 1])
            a = angles[i] + u * span
            points.append((r * math.sin(a), zc + r * math.cos(a)))
    points.append((0.0, 0.0))
    points.reverse()
    return points


PROFILE = head_profile()
PROFILE_Z = [z for _, z in PROFILE]


def head_half_width(z):
    if z <= 0 or z >= HEAD_HEIGHT:
        return 0.0
    i = bisect.bisect(PROFILE_Z, z)
    (h0, z0), (h1, z1) = PROFILE[i - 1], PROFILE[i]
    return h0 + (h1 - h0) * (z - z0) / max(z1 - z0, 1e-9)


def head_rings(count):
    """`count` heights along the side of the head, closer together where it turns: (z, half-width)."""
    weights = [0.0]
    for i in range(1, len(PROFILE)):
        (h0, z0), (h1, z1) = PROFILE[i - 1], PROFILE[i]
        turn = 0.0
        if 1 < i:
            hp, zp = PROFILE[i - 2]
            turn = abs(math.atan2(z1 - z0, h1 - h0) - math.atan2(z0 - zp, h0 - hp))
            turn = min(turn, 2 * math.pi - turn)
        weights.append(weights[-1] + math.hypot(h1 - h0, z1 - z0) + 0.12 * turn)
    out = []
    for k in range(1, count - 1):
        target = weights[-1] * k / (count - 1)
        i = bisect.bisect(weights, target)
        f = (target - weights[i - 1]) / max(weights[i] - weights[i - 1], 1e-9)
        (h0, z0), (h1, z1) = PROFILE[i - 1], PROFILE[i]
        out.append((z0 + (z1 - z0) * f, h0 + (h1 - h0) * f))
    return out


def inside_head(p):
    a = head_half_width(p.z)
    return a > 0 and (p.x / a) ** 2 + (p.y / (HEAD_DEPTH * a)) ** 2 < 1


def outline_clear(x, z):
    """True when (x, z), seen from the front, lies past the dark rim of the head."""
    x = abs(x)
    if x < head_half_width(z):
        return False
    best = 1e9
    for (h0, z0), (h1, z1) in zip(PROFILE, PROFILE[1:]):
        dx, dz = h1 - h0, z1 - z0
        f = max(0.0, min(1.0, ((x - h0) * dx + (z - z0) * dz) / max(dx * dx + dz * dz, 1e-12)))
        best = min(best, math.hypot(x - h0 - f * dx, z - z0 - f * dz))
    return best >= OUTLINE


def on_head(x, z):
    """The point of the front of the head at (x, z), and its normal."""
    a = head_half_width(z)
    y = -HEAD_DEPTH * a * math.sqrt(max(0.0, 1 - (x / a) ** 2))
    slope = (head_half_width(z + 0.005) - head_half_width(z - 0.005)) / 0.01
    return Vector((x, y, z)), Vector((x / a ** 2, y / (HEAD_DEPTH * a) ** 2, -slope / a)).normalized()


def ear_rows():
    """The lavender of the +X ear, the two logo ears averaged: (z, inner x, outer x), from the bottom up.

    Under its lobe the right ear of the logo is folded over, a notch cut in
    its outer edge: there the smooth outer edge of the left ear is followed.
    """
    out = []
    for row, r0, r1, l0, l1 in EAR_ROWS:
        # +0.5 px each side for the anti-aliased edge
        inner = ((r0 - 320) + (320 - l1)) / 2 / PX - 0.5 / PX
        outer = ((r1 - 320) + (320 - l0)) / 2 / PX + 0.5 / PX
        if EAR_FOLD[0] <= row <= EAR_FOLD[1]:
            outer = (320 - l0) / PX + 0.5 / PX
        out.append(((HEAD_BOTTOM_ROW - row) / PX, inner, outer))
    return sorted(out)


EAR = ear_rows()
EAR_TOP = (HEAD_BOTTOM_ROW - EAR_TOP_ROW) / PX


def ear_span(z):
    """Inner and outer x of the ear at height z: the logo rows, smoothly joined,
    the stem going on straight below the head outline, a round top above them."""
    zs = [r[0] for r in EAR]
    if z <= zs[0]:
        (z0, i0, o0), (z1, i1, _) = EAR[0], EAR[1]
        lean = (i1 - i0) / (z1 - z0)
        return i0 - (z0 - z) * lean, o0 - (z0 - z) * lean
    if z >= zs[-1]:
        _, i0, o0 = EAR[-1]
        c, w = (i0 + o0) / 2, (o0 - i0) / 2
        f = min(1.0, (z - zs[-1]) / (EAR_TOP - zs[-1]))
        w *= math.sqrt(max(0.0, 1 - f * f))
        return c - w, c + w
    i = bisect.bisect(zs, z) - 1
    u = (z - zs[i]) / (zs[i + 1] - zs[i])
    # Catmull-Rom through the rows, which are evenly spaced
    rows = [EAR[max(0, min(len(EAR) - 1, k))] for k in (i - 1, i, i + 1, i + 2)]
    return tuple(
        0.5 * (2 * rows[1][n] + (rows[2][n] - rows[0][n]) * u
               + (2 * rows[0][n] - 5 * rows[1][n] + 4 * rows[2][n] - rows[3][n]) * u * u
               + (3 * rows[1][n] - rows[0][n] - 3 * rows[2][n] + rows[3][n]) * u ** 3)
        for n in (1, 2))


# ---------- Meshes ----------

def around(count):
    return [2 * math.pi * j / count for j in range(count)]


def surface(name, rings, poles, materials, face_material=None):
    """A closed smooth mesh from rings of points, all the same size and in order, and the two poles.

    face_material(band, j) gives the material of each face: band -1 is the fan
    at the first pole, band len(rings) - 1 the fan at the last one.
    """
    n = len(rings[0])
    verts = [poles[0]] + [p for ring in rings for p in ring] + [poles[1]]
    last = len(verts) - 1
    faces, bands = [], []
    for j in range(n):
        faces.append((0, 1 + (j + 1) % n, 1 + j))
        bands.append((-1, j))
    for i in range(len(rings) - 1):
        a, b = 1 + i * n, 1 + (i + 1) * n
        for j in range(n):
            k = (j + 1) % n
            faces.append((a + j, a + k, b + k, b + j))
            bands.append((i, j))
    base = 1 + (len(rings) - 1) * n
    for j in range(n):
        faces.append((base + j, base + (j + 1) % n, last))
        bands.append((len(rings) - 1, j))
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    mesh = bmesh.new()
    mesh.from_mesh(me)
    bmesh.ops.recalc_face_normals(mesh, faces=mesh.faces[:])
    mesh.to_mesh(me)
    mesh.free()
    for m in materials:
        me.materials.append(m)
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    if face_material:
        me.polygons.foreach_set("material_index", [face_material(*band) for band in bands])
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o


def ellipsoid(name, center, axes, material, segments, rings):
    """axes: the three half-axes as vectors, the poles along the third one."""
    c = Vector(center)
    ex, ey, ez = (Vector(a) for a in axes)
    ring_points = []
    for i in range(1, rings):
        th = math.pi * i / rings
        ring_points.append([c + ex * (math.sin(th) * math.cos(p)) + ey * (math.sin(th) * math.sin(p)) + ez * math.cos(th) for p in around(segments)])
    return surface(name, ring_points, (c + ez, c - ez), [material])


def hull(obj, root=None):
    """The outline of a part: its mesh pushed out along the normals, turned inside out.

    root is (point, near, far): the outline thins to nothing near that point,
    where the part goes into another one, or it would poke out through it.
    """
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    mesh.normal_update()
    for v in mesh.verts:
        k = 1.0
        if root:
            point, near, far = root
            k = max(0.0, min(1.0, ((v.co - point).length - near) / (far - near)))
            k = k * k * (3 - 2 * k)
        v.co += v.normal * (OUTLINE * k)
    bmesh.ops.reverse_faces(mesh, faces=mesh.faces[:])
    me = bpy.data.meshes.new(obj.name + "-outline")
    mesh.to_mesh(me)
    mesh.free()
    me.materials.append(MATS["data-cloud-outline"])
    me.polygons.foreach_set("material_index", [0] * len(me.polygons))
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    o = bpy.data.objects.new(obj.name + "-outline", me)
    bpy.context.collection.objects.link(o)
    return o


def outlined(obj, root=None):
    return [obj, hull(obj, root)]


def collar(name, center, half_x, half_y):
    """A flat dark disk one outline thick: under the head and under the body, it
    stands in front of the part below and draws the outline where they meet."""
    return ellipsoid(name, center, ((half_x, 0, 0), (0, half_y, 0), (0, 0, OUTLINE / 2)), MATS["data-cloud-outline"], 24, 5)


def join(name, parts):
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    # Three.js makes every name unique on load: a mesh named like its node would become name_1
    o.data.name = name + "-mesh"
    return o


# ---------- The parts ----------

def head():
    rings = [[Vector((h * math.sin(p), -HEAD_DEPTH * h * math.cos(p), z)) for p in around(26)] for z, h in head_rings(17)]
    return surface("part-head", rings, (Vector((0, 0, 0)), Vector((0, 0, HEAD_HEIGHT))), [MATS["data-cloud-white"]])


def facial_mark(name, x, z, size, depth, material, segments, rings):
    """A flat oval lying on the front of the head, sunk in a little so its edge does not float."""
    p, n = on_head(x, z)
    across = Vector((0, 0, 1)).cross(n).normalized()
    up = n.cross(across).normalized()
    centre = p - n * 0.006
    # Sized as seen from the front, like the logo, whatever the slope of the head there
    axes = (across * (size[0] / abs(across.x)), up * (size[1] / abs(up.z)), n * depth)
    return ellipsoid(name, centre, axes, material, segments, rings), centre


def ear(name, side):
    """One ear in head coordinates, and its pivot. Each ring is a row of the
    logo: white at the back, lavender on the front half, dark at the root up to
    where it clears the outline of the head, so seen from the front the root
    disappears behind the head outline as on the logo."""

    def flat(z):
        inner, outer = ear_span(z)
        return Vector(((inner + outer) / 2, EAR_Y, z))

    # The pivot: where the middle of the ear comes out of the head
    z_root = EAR_ROOT
    while inside_head(flat(z_root)):
        z_root += 0.002
    pivot = flat(z_root)
    tilt = Matrix.Rotation(math.radians(-EAR_TILT), 3, "X")

    def place(p):
        return pivot + tilt @ (p - pivot)

    z_cut = z_root
    while True:
        inner, outer = ear_span(z_cut)
        if all(outline_clear(q.x, q.z) for q in (place(Vector((x, EAR_Y, z_cut))) for x in (inner, outer, (inner + outer) / 2))):
            break
        z_cut += 0.003
    # A hair more, so no white shows between the two dark rims
    z_cut += 0.006

    rows = [r[0] for r in EAR]
    # Every other row up the straight stem, every row from the lobe up
    heights = [EAR_ROOT + 0.035, EAR_ROOT + 0.1] + rows[0:5:2] + rows[5:] + [rows[-1] + f * (EAR_TOP - rows[-1]) for f in (0.45, 0.8)]
    heights = sorted(set(h for h in heights if abs(h - z_cut) > 0.02)) + [z_cut]
    heights.sort()
    widest = max(o - i for _, i, o in EAR) / 2

    segments = 12
    front = tilt @ Vector((0, -1, 0))
    across = tilt @ Vector((1, 0, 0))
    rings = []
    for z in heights:
        inner, outer = ear_span(z)
        w = (outer - inner) / 2
        t = EAR_THICKNESS * math.sqrt(w / widest)
        centre = place(Vector(((inner + outer) / 2, EAR_Y, z)))
        rings.append([centre + across * (w * math.sin(p)) + front * (t * math.cos(p)) for p in around(segments)])
    top_inner, top_outer = ear_span(rows[-1])
    poles = [place(flat(EAR_ROOT)), place(Vector(((top_inner + top_outer) / 2, EAR_Y, EAR_TOP)))]

    def face_material(band, j):
        upper = heights[band + 1] if band + 1 < len(heights) else EAR_TOP
        if band < 0 or upper <= z_cut + 1e-6:
            return 2
        return 1 if math.cos((j + 0.5) * 2 * math.pi / segments) > 0 else 0

    if side < 0:
        rings = [[Vector((-p.x, p.y, p.z)) for p in ring] for ring in rings]
        poles = [Vector((-p.x, p.y, p.z)) for p in poles]
        pivot = Vector((-pivot.x, pivot.y, pivot.z))
    o = surface(name, rings, poles, [MATS["data-cloud-white"], MATS["data-cloud-lavender"], MATS["data-cloud-outline"]], face_material)
    # No outline round the part of the root inside the head
    return o, pivot, (poles[0], 0.04, 0.16)


def cloud_surface(name, grow, material):
    """The puffs as one surface: from a point inside the middle puff, each ray
    goes as far as the farthest puff it crosses. With `grow` the puffs are that
    much bigger, which gives the outline a single rim with no seams between
    the puffs."""
    centre = Vector((0, 0.03, 0.15))
    # Rays spread over a squashed sphere the shape of the cloud, so its two
    # ends get as many as its middle
    spread = Vector((0.7, 0.45, 0.3))
    puffs = [(Vector((x, y, z)), Vector((rx + grow, ry + grow, rz + grow))) for x, y, z, rx, ry, rz in PUFFS]

    def reach(direction):
        best = 0.0
        for c, r in puffs:
            # The ray centre + t * direction against the ellipsoid, in its unit sphere
            o = Vector(((centre.x - c.x) / r.x, (centre.y - c.y) / r.y, (centre.z - c.z) / r.z))
            d = Vector((direction.x / r.x, direction.y / r.y, direction.z / r.z))
            a, b, k = d.dot(d), 2 * o.dot(d), o.dot(o) - 1
            disc = b * b - 4 * a * k
            if disc > 0:
                best = max(best, (-b + math.sqrt(disc)) / (2 * a))
        return centre + direction * best

    def ray(th, p):
        return Vector((spread.x * math.sin(th) * math.sin(p), -spread.y * math.sin(th) * math.cos(p), spread.z * math.cos(th))).normalized()

    # Rows evenly spaced along the side of that squashed sphere, not by angle,
    # or its flat top would get almost none
    rows, segments = 12, 24
    dense = [math.pi * k / 400 for k in range(401)]
    length = [0.0]
    for a, b in zip(dense, dense[1:]):
        length.append(length[-1] + math.hypot(spread.x * (math.sin(b) - math.sin(a)), spread.z * (math.cos(b) - math.cos(a))))
    angles = [dense[bisect.bisect(length, length[-1] * i / rows)] for i in range(1, rows)]
    rings = [[reach(ray(th, p)) for p in around(segments)] for th in angles]
    o = surface(name, rings, (reach(Vector((0, 0, 1))), reach(Vector((0, 0, -1)))), [material])
    if grow:
        # The outline: faces inside out, like the other hulls
        mesh = bmesh.new()
        mesh.from_mesh(o.data)
        bmesh.ops.reverse_faces(mesh, faces=mesh.faces[:])
        mesh.to_mesh(o.data)
        mesh.free()
    return o


def paw(name, side, shoulder):
    """A little arm hanging from the shoulder, out and a bit forward."""
    direction = Vector((side * 0.62, -0.3, -0.72)).normalized()
    across = direction.cross(Vector((0, 1, 0))).normalized()
    other = direction.cross(across).normalized()
    return ellipsoid(name, shoulder + direction * 0.1, (across * 0.075, other * 0.07, -direction * 0.14), MATS["data-cloud-white"], 10, 7)


def build():
    """Every node in place, the rabbit standing on the floor: (objects, pivots, parents)."""
    white = MATS["data-cloud-white"]
    nodes, pivots = {}, {}

    # The cloud, the body sitting on it and the head on the body, each one
    # just clear of the next, the gap hidden in the collars
    parts = [cloud_surface("part-cloud", 0, MATS["data-cloud-cloud"]), cloud_surface("part-cloud-outline", OUTLINE, MATS["data-cloud-outline"])]
    nodes["data-cloud-cloud"] = join("data-cloud-cloud", parts)
    cloud_top = max(z + rz for x, _, z, _, _, rz in PUFFS if abs(x) < 0.1)
    pivots["data-cloud-cloud"] = Vector((0, 0, -OUTLINE))

    body_z = cloud_top + CLEARANCE + BODY[2]
    neck = body_z + BODY[2] + CLEARANCE
    body = ellipsoid("part-body", (0, BODY_Y, body_z), ((BODY[0], 0, 0), (0, BODY[1], 0), (0, 0, BODY[2])), white, 16, 10)
    parts = outlined(body) + [collar("part-body-collar", (0, BODY_Y, cloud_top + OUTLINE / 2), 0.25, BODY[1] + 0.03)]
    nodes["data-cloud-body"] = join("data-cloud-body", parts)
    pivots["data-cloud-body"] = Vector((0, BODY_Y, body_z - BODY[2]))

    for name, side in (("data-cloud-paw-l", 1), ("data-cloud-paw-r", -1)):
        shoulder = Vector((side * 0.25, BODY_Y - 0.08, body_z + 0.04))
        nodes[name] = join(name, outlined(paw("part-" + name, side, shoulder), (shoulder, 0.05, 0.17)))
        pivots[name] = shoulder

    lift = Matrix.Translation((0, 0, neck))
    parts = outlined(head())
    nose, _ = facial_mark("part-nose", 0, NOSE_Z, NOSE_SIZE, 0.03, MATS["data-cloud-lavender"], 12, 6)
    parts += [nose, collar("part-head-collar", (0, 0, -OUTLINE / 2), 0.27, 0.3)]
    nodes["data-cloud-head"] = join("data-cloud-head", parts)
    pivots["data-cloud-head"] = Vector((0, 0, 0))
    for name, side in (("data-cloud-ear-l", 1), ("data-cloud-ear-r", -1)):
        o, pivot, root = ear("part-" + name, side)
        nodes[name] = join(name, outlined(o, root))
        pivots[name] = pivot
    for name, side in (("data-cloud-eye-l", 1), ("data-cloud-eye-r", -1)):
        o, centre = facial_mark("part-" + name, side * EYE_X, EYE_Z, EYE_SIZE, 0.028, MATS["data-cloud-eye"], 10, 6)
        nodes[name] = join(name, [o])
        pivots[name] = centre
    for name in ("data-cloud-head", "data-cloud-ear-l", "data-cloud-ear-r", "data-cloud-eye-l", "data-cloud-eye-r"):
        nodes[name].data.transform(lift)
        pivots[name] = lift @ pivots[name]

    # Stand it on the floor, outlines included, centred
    points = [v.co for o in nodes.values() for v in o.data.vertices]
    shift = Vector((
        (min(p.x for p in points) + max(p.x for p in points)) / 2,
        (min(p.y for p in points) + max(p.y for p in points)) / 2,
        min(p.z for p in points),
    ))
    for name, o in nodes.items():
        o.data.transform(Matrix.Translation(-shift))
        pivots[name] = pivots[name] - shift
    cloud = [v.co for v in nodes["data-cloud-cloud"].data.vertices]
    pivots["data-cloud-cloud"] = Vector(((min(p.x for p in cloud) + max(p.x for p in cloud)) / 2, (min(p.y for p in cloud) + max(p.y for p in cloud)) / 2, 0))
    parents = {
        "data-cloud-cloud": "data-cloud", "data-cloud-body": "data-cloud",
        "data-cloud-paw-l": "data-cloud", "data-cloud-paw-r": "data-cloud", "data-cloud-head": "data-cloud",
        "data-cloud-ear-l": "data-cloud-head", "data-cloud-ear-r": "data-cloud-head",
        "data-cloud-eye-l": "data-cloud-head", "data-cloud-eye-r": "data-cloud-head",
    }
    return nodes, pivots, parents


def assemble(nodes, pivots, parents):
    """Origins at the pivots, then the hierarchy under one empty at the origin."""
    root = bpy.data.objects.new("data-cloud", None)
    bpy.context.collection.objects.link(root)
    nodes["data-cloud"] = root
    pivots["data-cloud"] = Vector((0, 0, 0))
    for name, o in nodes.items():
        if name != "data-cloud":
            o.data.transform(Matrix.Translation(-pivots[name]))
    for name, parent in parents.items():
        nodes[name].parent = nodes[parent]
        nodes[name].location = pivots[name] - pivots[parent]
    for name, o in nodes.items():
        assert o.name == name, "Blender renamed %s to %s" % (name, o.name)
    return root


def report(path):
    """What the game gets: nodes in Three.js coordinates, triangles, size, culling."""
    with open(path, "rb") as f:
        data = f.read()
    gltf = json.loads(data[20:20 + struct.unpack_from("<I", data, 12)[0]])
    nodes = gltf["nodes"]
    parent = {c: i for i, n in enumerate(nodes) for c in n.get("children", [])}

    def offset(i):
        t = Vector(nodes[i].get("translation", (0, 0, 0)))
        return t + offset(parent[i]) if i in parent else t

    def show(i, depth):
        t = nodes[i].get("translation", (0, 0, 0))
        print("  " * depth + nodes[i]["name"], "translation", tuple(round(v, 3) for v in t), "world", tuple(round(v, 3) for v in offset(i)))
        for c in nodes[i].get("children", []):
            show(c, depth + 1)

    for i in gltf["scenes"][0]["nodes"]:
        show(i, 0)
    triangles, low, high = 0, 1e9, -1e9
    for i, n in enumerate(nodes):
        for p in gltf["meshes"][n["mesh"]]["primitives"] if "mesh" in n else []:
            triangles += gltf["accessors"][p["indices"]]["count"] // 3
            position = gltf["accessors"][p["attributes"]["POSITION"]]
            low = min(low, position["min"][1] + offset(i).y)
            high = max(high, position["max"][1] + offset(i).y)
            if "TEXCOORD_0" in p["attributes"]:
                print("warning: UVs exported on", n["name"])
    print("triangles", triangles, "size", os.path.getsize(path), "bytes", "height", round(high - low, 3), "from", round(low, 3), "to", round(high, 3))
    for m in gltf["materials"]:
        print("material", m["name"], "doubleSided", m.get("doubleSided", False),
              "color", [round(c, 3) for c in m["pbrMetallicRoughness"].get("baseColorFactor", [1, 1, 1, 1])],
              "emissive", [round(c, 3) for c in m.get("emissiveFactor", [0, 0, 0])])


def preview(directory, head_centre, height):
    scene = bpy.context.scene
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    # The logo colours as they are, no filmic curve
    scene.view_settings.view_transform = "Standard"
    scene.eevee.taa_render_samples = 32
    world = bpy.data.worlds.new("World")
    if world.node_tree is None:
        world.use_nodes = True
    tree = world.node_tree
    # The camera sees the logo background, the model is lit by a soft neutral sky
    ambient = tree.nodes["Background"]
    ambient.inputs[0].default_value = (0.32, 0.32, 0.34, 1)
    sky = tree.nodes.new("ShaderNodeBackground")
    sky.inputs[0].default_value = (*srgb(SKY), 1)
    path = tree.nodes.new("ShaderNodeLightPath")
    mix = tree.nodes.new("ShaderNodeMixShader")
    tree.links.new(path.outputs["Is Camera Ray"], mix.inputs[0])
    tree.links.new(ambient.outputs[0], mix.inputs[1])
    tree.links.new(sky.outputs[0], mix.inputs[2])
    tree.links.new(mix.outputs[0], tree.nodes["World Output"].inputs["Surface"])
    scene.world = world
    for name, direction, energy, shadow in (("key", (-0.35, 0.75, -0.6), 2.0, True), ("fill", (0.7, 0.7, 0.1), 0.6, False)):
        light = bpy.data.lights.new(name, "SUN")
        light.energy = energy
        light.angle = math.radians(12)
        light.use_shadow = shadow
        o = bpy.data.objects.new(name, light)
        bpy.context.collection.objects.link(o)
        o.rotation_euler = Vector(direction).to_track_quat("-Z", "Y").to_euler()

    def shoot(filename, camera, size):
        scene.render.resolution_x, scene.render.resolution_y = size
        scene.camera = camera
        scene.render.filepath = os.path.join(directory, filename)
        bpy.ops.render.render(write_still=True)
        print("preview", scene.render.filepath)

    # Straight front, orthographic, 260 px a unit: twice the scale of the logo
    front = bpy.data.cameras.new("front")
    front.type = "ORTHO"
    front.ortho_scale = 880 / 260
    camera = bpy.data.objects.new("front", front)
    bpy.context.collection.objects.link(camera)
    camera.location = (0, -10, height / 2)
    camera.rotation_euler = (math.radians(90), 0, 0)
    shoot("rabbit-front.png", camera, (760, 880))
    print("head centre in rabbit-front.png", round(380 + head_centre.x * 260), round(440 - (head_centre.z - height / 2) * 260))

    # Three-quarter, from the front-left and a little above
    side = bpy.data.cameras.new("three-quarter")
    side.lens = 70
    camera = bpy.data.objects.new("three-quarter", side)
    bpy.context.collection.objects.link(camera)
    target = Vector((0, 0, height * 0.5))
    azimuth, elevation, distance = math.radians(38), math.radians(16), 9.0
    camera.location = target + Vector((-math.sin(azimuth) * math.cos(elevation), -math.cos(azimuth) * math.cos(elevation), math.sin(elevation))) * distance
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    shoot("rabbit-34.png", camera, (800, 900))


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials()
    nodes, pivots, parents = build()
    root = assemble(nodes, pivots, parents)
    bpy.context.view_layer.update()
    triangles = sum(len(p.vertices) - 2 for o in nodes.values() if o.type == "MESH" for p in o.data.polygons)
    print("triangles in Blender", triangles)
    bpy.ops.object.select_all(action="DESELECT")
    for o in nodes.values():
        o.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_yup=True, export_apply=True, export_texcoords=False)
    print("exported", OUT)
    report(OUT)
    if PREVIEW_DIR:
        os.makedirs(PREVIEW_DIR, exist_ok=True)
        height = max((o.matrix_world @ v.co).z for o in nodes.values() if o.type == "MESH" for v in o.data.vertices)
        head_centre = pivots["data-cloud-head"] + Vector((0, 0, HEAD_HEIGHT / 2))
        preview(PREVIEW_DIR, head_centre, height)


main()
