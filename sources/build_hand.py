import bpy, math, os, sys, json, random
import numpy as np
from mathutils import Vector, Quaternion

OUT = os.path.abspath(sys.argv[sys.argv.index('--')+1])
os.makedirs(OUT, exist_ok=True)
TEX = os.path.join(OUT, '../textures/bone')
os.makedirs(TEX, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
random.seed(42)

# Work in the web scene's axes; Blender's exporter converts Z-up to Y-up.
def v(p): return Vector((p[0], -p[2], p[1]))

N=1024
yy,xx=np.mgrid[0:N,0:N]/N
rng=np.random.default_rng(17)
grain=rng.random((N,N))
vein=np.sin(xx*73+np.sin(yy*22)*1.9)
crack=np.exp(-((vein-.97)/.025)**2)*(.5+.5*np.sin(yy*113))
tone=np.clip(.91+.035*np.sin(xx*27+yy*19)+.025*grain-.11*crack,0,1)

def texture(name, rgb, noncolor=False):
    im=bpy.data.images.new(name,width=N,height=N,alpha=True)
    rgba=np.ones((N,N,4),dtype=np.float32)
    rgba[:,:,:3]=rgb
    im.pixels.foreach_set(rgba.ravel())
    if noncolor: im.colorspace_settings.name='Non-Color'
    im.filepath_raw=os.path.join(TEX,name+'.png'); im.file_format='PNG'; im.save(); im.pack()
    return im
base=texture('bone_basecolor',np.stack([tone,tone*.946,tone*.832],axis=2))
rough=texture('bone_roughness',np.repeat((.65+.15*grain)[:,:,None],3,axis=2),True)
height=.025*np.sin(xx*75+yy*22)+.008*grain-.018*crack
dy,dx=np.gradient(height)
normal=np.stack([-dx*19,-dy*19,np.ones((N,N))],axis=2)
normal/=np.linalg.norm(normal,axis=2)[:,:,None]
normal=texture('bone_normal',normal*.5+.5,True)
mat=bpy.data.materials.new('Ivory • worn Kaguya bone'); mat.use_nodes=True
nodes=mat.node_tree.nodes; links=mat.node_tree.links; bs=nodes.get('Principled BSDF')
bs.inputs['Roughness'].default_value=.72
for im,socket in [(base,'Base Color'),(rough,'Roughness')]:
    n=nodes.new('ShaderNodeTexImage'); n.image=im; links.new(n.outputs['Color'],bs.inputs[socket])
n=nodes.new('ShaderNodeTexImage'); n.image=normal
nm=nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value=.3
links.new(n.outputs['Color'],nm.inputs['Color']); links.new(nm.outputs['Normal'],bs.inputs['Normal'])

arm=bpy.data.armatures.new('Zaoki hand skeleton')
rig=bpy.data.objects.new('Zaoki_Bone_Hand',arm); bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig; rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
def bone(name,a,b,parent=None):
    eb=arm.edit_bones.new(name); eb.head=v(a); eb.tail=v(b)
    if parent: eb.parent=arm.edit_bones[parent]
    return eb
bone('wrist',(2.28,0,.04),(1.52,0,.07))
bone('palm',(1.52,0,.07),(.59,0,.12),'wrist')
fingers={}
for name,y,L in [('index',.36,1.0),('middle',.115,1.12),('ring',-.14,1.03),('pinky',-.37,.82)]:
    p=[(.59,y,.25),(.59-.40*L,y,.25),(.59-.72*L,y,.105),(.59-.97*L,y,.070)]
    fingers[name]=p
    for j in range(3): bone(name+'_'+str(j+1),p[j],p[j+1],'palm' if j==0 else name+'_'+str(j))
thumb=[(1.20,-.34,-.015),(.73,-.52,-.12),(.25,-.30,-.065),(-.20,-.10,-.060)]
fingers['thumb']=thumb
for j in range(3): bone('thumb_'+str(j+1),thumb[j],thumb[j+1],'palm' if j==0 else 'thumb_'+str(j))
bpy.ops.object.mode_set(mode='OBJECT')
rig.select_set(False)
parts=[]

def bind(obj,name):
    obj.data.materials.append(mat)
    for poly in obj.data.polygons: poly.use_smooth=True
    vg=obj.vertex_groups.new(name=name); vg.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    parts.append(obj)

def shaft(name,a,b,r,tip=False):
    # Flared, asymmetric epiphyses joined by a slender bowed shaft.
    a,b=v(a),v(b); axis=(b-a).normalized()
    side=axis.cross(Vector((0,0,1)))
    if side.length<.01: side=axis.cross(Vector((0,1,0)))
    side.normalize(); up=axis.cross(side)
    verts=[]; faces=[]; steps=13; sides=12
    profile=[.52,.91,1.02,.78,.60,.55,.53,.55,.60,.69,.95,1.03,.51]
    for i in range(steps):
        t=i/(steps-1); c=a.lerp(b,t)+up*(math.sin(t*math.pi)*r*.22)
        rad=r*profile[i]*(1-.22*t)
        if tip: rad*=1-.85*t**3
        for j in range(sides):
            q=j*2*math.pi/sides
            bump=1+.055*math.sin(j*3.4+i*1.7)
            verts.append(c+side*(math.cos(q)*rad*bump)+up*(math.sin(q)*rad*.82*bump))
    for i in range(steps-1):
        for j in range(sides):
            a0=i*sides+j; a1=i*sides+(j+1)%sides
            faces.append((a0,a1,a1+sides,a0+sides))
    faces.append(tuple(reversed(range(sides)))); faces.append(tuple((steps-1)*sides+j for j in range(sides)))
    me=bpy.data.meshes.new(name+' geometry'); me.from_pydata(verts,[],faces); me.update()
    ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob); bind(ob,name.split(':')[0]); return ob

def joint(name,point,scale):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=v(point))
    ob=bpy.context.object; ob.name=name; ob.scale=(scale[0],scale[2],scale[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); bind(ob,name.split(':')[0]); ob.select_set(False)

shaft('wrist:radius',(2.4,.13,.05),(1.49,.12,.07),.092)
shaft('wrist:ulna',(2.4,-.13,.005),(1.48,-.12,.045),.067)
for i in range(8):
    x=1.40+(i//4)*.14; y=(i%4-1.5)*.13
    joint('palm:carpal'+str(i),(x,y,.07),(.10,.078,.064))
for name,p in fingers.items():
    if name!='thumb':
        shaft('palm:metacarpal_'+name,(1.40,p[0][1]*.40,.075),p[0],.065 if name!='pinky' else .053)
    for j in range(3):
        r=([.075,.055,.045] if name!='thumb' else [.069,.052,.036])[j]
        if name=='pinky': r*=.83
        shaft(name+'_'+str(j+1)+':shaft',p[j],p[j+1],r,j==2)
        joint(name+'_'+str(j+1)+':knuckle',p[j],(r*.70,r*1.03,r*.85))
        if j<2:
            # Paired condyles keep the joints recognizable at web scale.
            for s in [-1,1]:
                pos=list(p[j]); pos[1]+=s*r*.49
                joint(name+'_'+str(j+1)+':condyle',pos,(r*.65,r*.6,r*.75))
# Small organic styloid spurs near the wrist, away from the contact surface.
shaft('wrist:styloid',(1.61,.20,.06),(1.48,.30,.15),.055,True)
shaft('palm:crest',(1.25,-.22,.10),(.99,-.30,.19),.044,True)

bpy.ops.object.select_all(action='DESELECT')
for ob in parts: ob.select_set(True)
bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join()
mesh=bpy.context.object; mesh.name='Bone_Hand_Surface'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.012)
bpy.ops.object.mode_set(mode='OBJECT')
mod=mesh.modifiers.new('Articulated skeleton','ARMATURE'); mod.object=rig; mesh.parent=rig
grip=bpy.data.objects.new('HandGripPoint',None); bpy.context.collection.objects.link(grip); grip.parent=rig
grip.empty_display_type='SPHERE'; grip.empty_display_size=.08
grip['purpose']='Cover edge contact; local origin. Four fingers in front, thumb behind.'

# Grip is a normalized 1-second clip: open at frame 1, contact at frame 31.
scene=bpy.context.scene; scene.render.fps=30; scene.frame_start=1; scene.frame_end=31
for name in fingers:
    for j in range(3):
        pb=rig.pose.bones[name+'_'+str(j+1)]; pb.rotation_mode='QUATERNION'
        # Thumb spreads laterally in the cover/page gap, never down through pages.
        web_axis=Vector((0,-1,0)) if name=='thumb' else Vector((0,0,1))
        local_axis=pb.bone.matrix_local.to_quaternion().inverted() @ web_axis
        angle=[.52,.30,.21][j]
        pb.rotation_quaternion=Quaternion(local_axis,angle); pb.keyframe_insert('rotation_quaternion',frame=1)
        pb.rotation_quaternion=Quaternion(); pb.keyframe_insert('rotation_quaternion',frame=31)
rig.animation_data.action.name='Grip'
scene.frame_set(1)
mesh.data.calc_loop_triangles()
stats={'triangles':len(mesh.data.loop_triangles),'bones':len(arm.bones),'textures':1024,'clip':'Grip','contact_frame':31}
with open(os.path.join(OUT,'bone_hand.stats.json'),'w') as f: json.dump(stats,f,indent=2)
scene.world.color=(.08,.06,.10)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'bone_hand.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in [mesh,rig,grip]: ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'bone_hand.glb'),export_format='GLB',use_selection=True,export_animations=True,export_extras=True,export_yup=True)
print('HAND_STATS',json.dumps(stats))
