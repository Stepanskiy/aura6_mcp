from pathlib import Path
p=Path('C:/Aura/aura6_mcp/tmp/pdfs/build_publicis.py')
s=p.read_text(encoding='utf-8-sig')
s=s.replace('Аура6_технології_простими_словами.pdf','Аура6_технології_візуальна_версія.pdf')
s=s.replace("INK='#15273C'; MUT='#56677A'; BLUE='#2257CB'; TEAL='#087D79'; GOLD='#B56D16'; BG='#F5F7FA'; LIGHT='#E5EBF4'", "INK='#22221F'; MUT='#62625B'; BLUE='#8F713F'; TEAL='#5E604E'; GOLD='#A38450'; BG='#FFFFFF'; LIGHT='#DFDFD7'")
s=s.replace("def node(x,y,w,h,title,body='',color=BLUE):\n rect(x,y,w,h,'#FFFFFF',LIGHT,8);rect(x,y,5,h,color)\n title_h=text(title,x+23,y+20,w-44,25,color,True)\n if body:text(body,x+23,y+20+title_h+12,w-44,20,MUT)","""def node(x,y,w,h,title,body='',color=BLUE):
 kinds={'Працівник':0,'Екрани Аури':1,'Сервер Аури':2,'База даних':3,'Обліковий запис':4,'Перевірка входу':9,'Доступ до Аури':4,'У Microsoft Teams':1,'У браузері':1,'1. Прийняти дію':5,'2. Перевірити':9,'3. Зберегти':3,'Проєкти та роботи':11,'Рахунки й оплати':5,'План та історія':11,'Модель':7,'Екран звіту':1,'Погодити середовище':8,'Реалізувати основу':6,'Перевірити пілот':10}
 if not title.startswith('У '): icon(kinds.get(title,6),x+16,y-75,72)
 title_h=text(title,x+16,y+20,w-30,25,INK,True)
 if body:text(body,x+16,y+20+title_h+12,w-30,20,MUT)
""")
s=s.replace("rect(58,y,1164,55,'#E8EEF9');text(t,77,y+14,1124,19,INK)","line(58,y,1222,y,LIGHT,1);text(t,58,y+17,1164,19,MUT)")
s=s.replace("text('АУРА 6',58,27,750,14,MUT,True)","text('АУРА 6',58,27,750,14,BLUE,True)")
s=s.replace("rect(0,0,W,H,INK)","rect(0,0,W,H,'#FFFFFF')")
s=s.replace("'#83B5FF'","BLUE").replace("'#D5E1F2'","MUT").replace("'#40546A'","LIGHT")
s=s.replace("text('Технології<br/>простими словами',65,150,1120,62,'#FFFFFF',True)","text('Технології<br/>простими словами',65,150,850,62,INK,True);icon(6,965,160,230)")
s=s.replace("text(title,x,540,340,27,'#FFFFFF',True)","text(title,x,540,340,27,INK,True)")
# Small chapter icons make the flat editorial layouts visually consistent.
s=s.replace("text('ОДИН ЗАСТОСУНОК',60,228", "icon(1,500,210,92);text('ОДИН ЗАСТОСУНОК',60,228")
s=s.replace("text('Azure App Service',60,225", "icon(8,490,470,90);text('Azure App Service',60,225")
s=s.replace("text('Власні сервери та IIS',700,225", "icon(2,1120,470,90);text('Власні сервери та IIS',700,225")
s=s.replace("text('Microsoft',", "text('Microsoft',")
s=s.replace("text('Приклад: зберегти рахунок клієнту',60,215", "text('Приклад: зберегти рахунок клієнту',60,180")
s=s.replace("text('«Покажи маржу по клієнтах за квартал»',60,223", "text('«Покажи маржу по клієнтах за квартал»',60,195")
s=s.replace("node(58,232", "node(58,255").replace("node(490,232", "node(490,255").replace("node(922,232", "node(922,255")
s=s.replace("arrow(358,307,490,307);arrow(790,307,922,307)", "arrow(358,330,490,330);arrow(790,330,922,330)")
s=s.replace('Аура6_технології_візуальна_версія.pdf','Аура6_стек_технологій.pdf')
s=s.replace('Аура 6. Технології простими словами','Стек технологій для системи управлінського обліку')
s=s.replace("text('Технології<br/>простими словами',65,150,850,62,INK,True)", "text('Стек технологій<br/>для системи<br/>управлінського обліку',65,120,870,52,INK,True)")
s=s.replace("text('Як працюватиме система управлінського обліку<br/>в середовищі Microsoft',68,330,1080,30,MUT)", "text('Архітектура Аури 6 у середовищі Microsoft',68,335,1100,28,MUT);text('Заміна платформи 1С: перехід на вебсистему зі збереженням<br/>предметної логіки та поетапною міграцією даних.',68,398,1110,23,INK)")
s=s.replace('Microsoft Entra ID можна уявити як корпоративну перепустку.','Корпоративна автентифікація через Microsoft Entra ID.')
prefix="""
from reportlab.lib.utils import ImageReader
from PIL import Image
ATLAS=Path('C:/Aura/aura6_mcp/drafts/ЧатГПТ/assets/technology-icons.png')
atlas_img=Image.open(ATLAS)
atlas_w,atlas_h=atlas_img.size
atlas_reader=ImageReader(atlas_img)
icon_bounds=[]
for idx in range(12):
 col,row=idx%4,idx//4
 l,t,r,b=int(col*atlas_w/4),int(row*atlas_h/3),int((col+1)*atlas_w/4),int((row+1)*atlas_h/3)
 cell=atlas_img.crop((l,t,r,b)).convert('L')
 bounds=cell.point(lambda v:255 if v<170 else 0).getbbox()
 a,bb,cc,d=bounds
 icon_bounds.append((l+a-9,t+bb-9,l+cc+9,t+d+9))
def icon(idx,x,y,size):
 # Place a single atlas cell using PDF clipping. The source image stays intact.
 l,t,r,b=icon_bounds[idx]
 cw,ch=r-l,b-t
 scale=size/max(cw,ch)
 dw,dh=atlas_w*scale,atlas_h*scale
 cellw,cellh=cw*scale,ch*scale
 xx=x+(size-cellw)/2; yy=y+(size-cellh)/2
 c.saveState()
 path=c.beginPath();path.rect(xx,H-yy-cellh,cellw,cellh);c.clipPath(path,stroke=0,fill=0)
 c.drawImage(atlas_reader,xx-l*scale,H-yy-dh+t*scale,width=dw,height=dh,mask='auto')
 c.restoreState()
"""
s=s.replace('# 1\nrect',prefix+'\n# 1\nrect')
Path('C:/Aura/aura6_mcp/tmp/pdfs/build_editorial.py').write_text(s,encoding='utf-8')
