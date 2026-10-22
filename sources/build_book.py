import bpy, os, sys, math, json
from mathutils import Vector
OUT=os.path.abspath(sys.argv[sys.argv.index('--')+1]);os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def v(p):return (p[0],-p[2],p[1])
def material(name,color,metal=0,rough=.5):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    return m
leather=material('Oxblood Leather',(.105,.012,.029),0,.52)
gold=material('Antique brass',(.53,.31,.10),.75,.32)
darkgold=material('Aged brass recesses',(.22,.115,.035),.7,.48)
paper=material('Ivory page edges',(.64,.48,.27),0,.91)
red=material('Crimson silk',(.22,.008,.028),.05,.42)
dark=material('Binding shadow',(.026,.007,.012),0,.8)
objects=[]
def empty(name,parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;return o
opened=empty('OpenBook');closed=empty('ClosedBook')
def cube(name,loc,size,mat,parent,bevel=.004):
    bpy.ops.mesh.primitive_cube_add(size=1,location=v(loc));o=bpy.context.object;o.name=name
    o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        m=o.modifiers.new('Worn soft edges','BEVEL');m.width=bevel;m.segments=3
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
    for f in o.data.polygons:f.use_smooth=True
    o.parent=parent;objects.append(o);return o
def tube(name,points,radius,mat,parent):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=8;c.bevel_depth=radius;c.bevel_resolution=2
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*v(co),1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(mat);o.parent=parent
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);objects.append(o);return o
def medallion(parent,x,y,z,r):
    bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=r,depth=.012,location=v((x,y,z)),rotation=(math.pi/2,0,0))
    o=bpy.context.object;o.name='Kaguya medallion';o.data.materials.append(gold);o.parent=parent;objects.append(o)
    for rr,mat in [(r*.86,darkgold),(r*.76,gold)]:
        points=[(x+rr*math.cos(i*math.tau/64),y+rr*math.sin(i*math.tau/64),z+.009) for i in range(65)]
        tube('Engraved seal rim',points,.002,mat,parent)
    for sx in [-1,1]:
        tube('Bone sigil',[(x+sx*.023,y-.027,z+.011),(x+sx*.012,y-.012,z+.011),(x+sx*.012,y+.028,z+.011)],.004,darkgold,parent)
    tube('Bone sigil crown',[(x-.03,y+.025,z+.011),(x,y+.012,z+.011),(x+.03,y+.025,z+.011)],.003,darkgold,parent)
def corner(parent,x,y,sx,sy,z):
    # Sculpted corner mounts and curled filigree, with a raised inner lip.
    cube('Brass corner horizontal',(x-sx*.045,y,z),(.105,.012,.014),gold,parent,.003)
    cube('Brass corner vertical',(x,y-sy*.045,z),(.012,.105,.014),gold,parent,.003)
    tube('Corner filigree',[(x-sx*(.025+.032*math.cos(t)),y-sy*(.027+.032*math.sin(t)),z+.007) for t in [i*math.pi*1.6/20 for i in range(21)]],.003,gold,parent)
    for dx,dy in [(.015,.015),(.082,.006),(.006,.082)]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=5,radius=.005,location=v((x-sx*dx,y-sy*dy,z+.008)))
        o=bpy.context.object;o.name='Brass pin';o.data.materials.append(darkgold);o.parent=parent;objects.append(o)

# Normalized open spread: width 2, height 1.24, reading surface z=0.
for side in [-1,1]:
    cube('Leather board',(.505*side,0,-.045),(.99,1.24,.036),leather,opened,.014)
    for i in range(9):
        w=.961-abs(4-i)*.0018
        cube('Layered paper',(.495*side,-.004,-.027+i*.0026),(w,1.192,.0022),paper,opened,.004)
    for y in [-.594,.594]:
        tube('Gilded board edge',[(side*.025,y,-.018),(side*.97,y,-.018)],.0026,gold,opened)
    for sy in [-1,1]:corner(opened,side*.981,sy*.602,side,sy,.007)
cube('Leather spine',(0,0,-.034),(.068,1.255,.07),dark,opened,.024)
for phase in [0,math.pi]:
    tube('Braided crimson binding',[(.006*math.cos(i*.96+phase),-.63+i*(1.25/219),.014+.006*math.sin(i*.96+phase)) for i in range(220)],.005,red,opened)
for y in [-.55,-.30,0,.3,.55]:cube('Binding knot',(0,y,.02),(.025,.016,.018),darkgold,opened,.005)
medallion(opened,0,-.08,.038,.039)
for i in range(11):
    x=(i-5)*.0025
    tube('Silk tassel',[(x,-.60,.015),(x+.004,-.66,.018),(x+.025,-.73-.012*math.sin(i),.008)],.0018,red,opened)

# Closed volume, separate hinged cover for the opening controller.
cube('Closed backboard',(0,0,-.064),(1,1.43,.025),leather,closed,.012)
for i in range(11):cube('Closed page layer',(.008,-.005,-.052+i*.0035),(.973,1.405,.0029),paper,closed,.003)
cover=empty('BlenderCoverHinge',closed);cover.location=v((-.5,0,0))
front=empty('CoverGeometry',cover);front.location=v((.5,0,0))
# A rim only: the original HTML ink is left completely readable in the middle.
for sx in [-1,1]:cube('Cover leather rim',(sx*.486,0,-.004),(.028,1.43,.025),leather,front,.008)
for sy in [-1,1]:cube('Cover leather rim',(0,sy*.700,-.004),(.98,.03,.025),leather,front,.006)
for sx in [-1,1]:
    for sy in [-1,1]:corner(front,sx*.475,sy*.690,sx,sy,.014)
for sx in [-1,1]:tube('Cover gold tooling',[(sx*.458,-.662,.014),(sx*.458,.662,.014)],.0022,gold,front)
for sy in [-1,1]:tube('Cover gold tooling',[(-.458,sy*.662,.014),(.458,sy*.662,.014)],.0022,gold,front)
cube('Closed leather spine',(-.49,0,-.03),(.058,1.44,.09),dark,closed,.025)
for y in [-.56,-.28,.28,.56]:cube('Raised binding bands',(-.49,y,-.008),(.063,.035,.086),leather,closed,.01)
for i in range(7):tube('Closed bookmark',[(.32+(i-3)*.002,-.67,-.06),(.325+(i-3)*.002,-.77,-.07),(.34+(i-3)*.002,-.83,-.06)],.002,red,closed)

for parent in [opened,closed,front]:
    bpy.ops.object.select_all(action='DESELECT')
    pieces=[o for o in bpy.data.objects if o.type=='MESH' and o.parent==parent]
    for o in pieces:o.select_set(True)
    bpy.context.view_layer.objects.active=pieces[0]
    bpy.ops.object.join()
    bpy.context.object.name=parent.name+'_Surface'
bpy.ops.object.select_all(action='DESELECT')
triangles=0
for o in list(bpy.data.objects):
    if o.type=='MESH':o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
    o.select_set(True)
for o in [opened,closed,cover,front]:o.select_set(True)
scene=bpy.context.scene
bpy.context.view_layer.objects.active=opened
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'book_frame.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'book_frame.glb'),export_format='GLB',use_selection=True,export_yup=True)
with open(os.path.join(OUT,'book_frame.stats.json'),'w')as f:json.dump({'triangles':triangles,'variants':['OpenBook','ClosedBook'],'coverHinge':'BlenderCoverHinge'},f,indent=2)
print('BOOK TRIANGLES',triangles)
