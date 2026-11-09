from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER

ROOT=Path('C:/Aura/aura6_mcp')
OUT=ROOT/'drafts/ЧатГПТ/output/pdf/Аура6_стек_технологій.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('Arial','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialB','C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Arial',normal='Arial',bold='ArialB',italic='Arial',boldItalic='ArialB')
W,H=1280,720
INK='#22221F'; MUT='#62625B'; BLUE='#8F713F'; TEAL='#5E604E'; GOLD='#A38450'; BG='#FFFFFF'; LIGHT='#DFDFD7'
c=canvas.Canvas(str(OUT),pagesize=(W,H))
c.setTitle('Стек технологій для системи управлінського обліку')
c.setAuthor('Аура 6')
def rect(x,y,w,h,fill,stroke=None,r=0):
 c.setFillColor(HexColor(fill)); c.setStrokeColor(HexColor(stroke or fill))
 if r:c.roundRect(x,H-y-h,w,h,r,fill=1,stroke=bool(stroke))
 else:c.rect(x,H-y-h,w,h,fill=1,stroke=bool(stroke))
def text(t,x,y,w,size=25,color=INK,bold=False,align=TA_LEFT):
 st=ParagraphStyle('p',fontName='ArialB' if bold else 'Arial',fontSize=size,leading=size*1.23,textColor=HexColor(color),alignment=align)
 p=Paragraph(t,st); aw,ah=p.wrap(w,1000)
 assert y+ah <= H-8, (t,y,ah)
 p.drawOn(c,x,H-y-ah)
 return ah
def line(x1,y1,x2,y2,color=BLUE,width=2):
 c.setStrokeColor(HexColor(color));c.setLineWidth(width);c.line(x1,H-y1,x2,H-y2)
def arrow(x1,y1,x2,y2,color=BLUE):
 line(x1,y1,x2,y2,color,2.5)
 import math
 a=math.atan2(y2-y1,x2-x1)
 for off in [-.52,.52]:line(x2,y2,x2-11*math.cos(a+off),y2-11*math.sin(a+off),color,2.5)
def node(x,y,w,h,title,body='',color=BLUE):
 kinds={'Працівник':0,'Екрани Аури':1,'Сервер Аури':2,'База даних':3,'Обліковий запис':4,'Перевірка входу':9,'Доступ до Аури':4,'У Microsoft Teams':1,'У браузері':1,'1. Прийняти дію':5,'2. Перевірити':9,'3. Зберегти':3,'Проєкти та роботи':11,'Рахунки й оплати':5,'План та історія':11,'Модель':7,'Екран звіту':1,'Погодити середовище':8,'Реалізувати основу':6,'Перевірити пілот':10}
 if not title.startswith('У '): icon(kinds.get(title,6),x+16,y-75,72)
 title_h=text(title,x+16,y+20,w-30,25,INK,True)
 if body:text(body,x+16,y+20+title_h+12,w-30,20,MUT)

def base(n,title,sub=''):
 rect(0,0,W,H,BG);text('АУРА 6',58,27,750,14,BLUE,True)
 text(title,58,76,1164,38,INK,True)
 if sub:text(sub,60,137,1150,21,MUT)
 line(58,665,1222,665,LIGHT,1)
 text('Пропозиція для пілоту · 9 листопада 2026',58,682,1050,13,MUT)
 text(f'{n:02d} / 12',1125,680,98,15,MUT,align=2)
def end():c.showPage()
def note(t,y=591):
 line(58,y,1222,y,LIGHT,1);text(t,58,y+17,1164,19,MUT)


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

# 1
rect(0,0,W,H,'#FFFFFF')
text('АУРА 6',65,58,1100,18,BLUE,True)
text('Стек технологій<br/>для системи<br/>управлінського обліку',65,120,870,52,INK,True);icon(6,965,160,230)
text('Архітектура Аури 6 у середовищі Microsoft',68,335,1100,28,MUT);text('Заміна платформи 1С: перехід на вебсистему зі збереженням<br/>предметної логіки та поетапною міграцією даних.',68,398,1110,23,INK)
line(68,470,1210,470,LIGHT,1)
for x,num,title,body in [(68,'01','Зручний вхід','Teams або браузер'),(470,'02','Єдині правила','Сервер Аури'),(870,'03','Контроль даних','Інфраструктура компанії')]:
 text(num,x,505,320,17,BLUE,True);text(title,x,540,340,27,INK,True);text(body,x,583,340,20,MUT)
text('Концепція пілоту · 9 листопада 2026',68,673,1080,15,MUT);end()
# 2
base(2,'Загальна схема','Кожна частина має свою роль. Разом вони утворюють одну систему.')
node(58,238,240,150,'Працівник','Відкриває Ауру<br/>в Teams або браузері')
node(360,238,260,150,'Екрани Аури','React + TypeScript<br/>Зручні форми та звіти')
node(682,238,250,150,'Сервер Аури','Node.js<br/>Перевіряє дії та рахує')
node(994,238,228,150,'База даних','Azure SQL<br/>Зберігає облік')
for a,b in [(298,360),(620,682),(932,994)]:arrow(a,313,b,313)
text('Microsoft Entra ID',60,450,550,26,TEAL,True)
text('Перевіряє, хто входить у систему',60,495,550,23,MUT)
text('Azure OpenAI',682,450,540,26,TEAL,True)
text('Допомагає зрозуміти питання працівника',682,495,540,23,MUT)
note('Сервер Аури керує доступом і правилами для всіх екранів та помічника.');end()
# 3
base(3,'Вхід через робочий обліковий запис','Корпоративна автентифікація через Microsoft Entra ID.')
node(58,240,300,164,'Обліковий запис','Та сама робоча адреса,<br/>що й у Microsoft 365')
node(490,240,300,164,'Перевірка входу','Entra ID перевіряє особу<br/>та правила безпеки',TEAL)
node(922,240,300,164,'Доступ до Аури','Аура визначає доступні<br/>фірми, проєкти й дії')
arrow(358,322,490,322);arrow(790,322,922,322)
text('Що це дає працівнику',60,456,550,27,INK,True)
text('Менше окремих паролів.<br/>Звичний корпоративний вхід.',60,505,550,25,MUT)
text('Що контролює компанія',680,456,540,27,INK,True)
text('Кому дозволено входити.<br/>Які дані та дії доступні в Аурі.',680,505,540,25,MUT)
note('Після блокування облікового запису новий вхід припиняється. Строк чинних сесій налаштовує ІТ.',606);end()
# 4
base(4,'Екрани, з якими працює команда','React створює вебекрани. TypeScript допомагає розробникам узгоджувати їхню роботу.')
icon(1,500,210,92);text('ОДИН ЗАСТОСУНОК',60,228,530,16,BLUE,True)
text('Проєкти та медіаплани<br/>Імпорт бюджетів з Excel<br/>Рахунки й звірка<br/>Звіти та графіки',60,273,570,31,INK)
node(735,225,440,125,'У Microsoft Teams','Аура як вкладка в робочому середовищі')
node(735,402,440,125,'У браузері','Та сама система за окремою адресою')
arrow(610,295,735,295);arrow(610,464,735,464)
note('Fluent UI надає готові елементи у стилі Microsoft: таблиці, поля вводу та меню.');end()
# 5
base(5,'Сервер Аури виконує правила обліку','Node.js запускає серверну частину. TypeScript описує її логіку.')
text('Приклад: зберегти рахунок клієнту',60,180,1100,29,INK,True)
node(58,294,300,155,'1. Прийняти дію','Екран передає рахунок<br/>через API')
node(490,294,300,155,'2. Перевірити','Права користувача,<br/>роботи та суми',TEAL)
node(922,294,300,155,'3. Зберегти','Запис у базі<br/>та історія зміни')
arrow(358,371,490,371);arrow(790,371,922,371)
text('API',60,507,110,28,BLUE,True)
text('Узгоджений спосіб, яким екрани й помічник звертаються до сервера.',175,508,1025,25,MUT)
note('Якщо дія порушує правило, сервер повертає пояснення і відхиляє запис.');end()
# 6
base(6,'База даних зберігає спільний облік','Azure SQL Database - керована база Microsoft у хмарному середовищі компанії.')
node(58,240,340,185,'Проєкти та роботи','Клієнти, бренди, медіаплани,<br/>доходи та витрати')
node(470,240,340,185,'Рахунки й оплати','Зв’язок фінансових<br/>документів із роботами')
node(882,240,340,185,'План та історія','Версії бюджету,<br/>закриті роботи, зміни')
text('Спільне сховище',60,475,530,28,TEAL,True)
text('Команда працює з одними даними.<br/>Звіти спираються на той самий облік.',60,520,550,23,MUT)
text('Резервні копії',680,475,540,28,TEAL,True)
text('Azure SQL підтримує автоматичні копії.<br/>ІТ погоджує строки та перевіряє відновлення.',680,520,540,23,MUT)
end()
# 7
base(7,'Помічник розуміє питання працівника','Azure OpenAI надає модель, яку Аура використовує у власному помічнику.')
text('«Покажи маржу по клієнтах за квартал»',60,195,1155,34,BLUE,True)
node(58,322,305,155,'Модель','Перетворює питання<br/>на параметри звіту',TEAL)
node(490,322,300,155,'Сервер Аури','Перевіряє запит<br/>і доступ до даних')
node(922,322,300,155,'Екран звіту','Показує таблицю<br/>та графік')
arrow(363,397,490,397);arrow(790,397,922,397)
text('Copilot',60,525,180,26,INK,True);text('Готовий помічник у продуктах Microsoft.',250,526,945,24,MUT)
text('Azure OpenAI',60,572,240,26,INK,True);text('Сервіс для помічника всередині Аури.',330,573,865,24,MUT)
end()
# 8
base(8,'Компанія визначає, що бачить ШІ','Рівень доступу моделі потрібно погодити до роботи з реальними даними.')
rows=[('1','Лише питання','Модель обирає звіт. Цифри бачить працівник.'),('2','Питання та підсумки','Модель може пояснити загальні результати.'),('3','Дозволені рядки','Модель може аналізувати окремі роботи.')]
for i,(n,title,body) in enumerate(rows):
 y=221+i*109
 text(n,64,y,80,40,BLUE,True);text(title,160,y+1,500,28,INK,True);text(body,160,y+45,1030,24,MUT)
note('Для імпорту Excel окремо погоджують передачу зразків рядків і назв довідників.',575)
text('Регіон обробки та правила зберігання запитів залежать від налаштувань сервісу й умов Microsoft.',60,640,1150,14,MUT)
end()
# 9
base(9,'Де працюватиме система','Два варіанти розміщення для погодження з ІТ компанії.')
icon(8,490,470,90);text('Azure App Service',60,225,550,33,BLUE,True)
text('Рекомендований варіант у хмарі',60,280,550,23,TEAL,True)
text('Microsoft обслуговує платформу.<br/>Команда Аури оновлює застосунок.<br/>ІТ керує доступами й налаштуваннями.',60,333,540,25,MUT)
line(638,215,638,537,LIGHT,2)
icon(2,1120,470,90);text('Власні сервери та IIS',700,225,520,33,INK,True)
text('Варіант за вимогами компанії',700,280,520,23,TEAL,True)
text('ІТ підтримує серверне середовище.<br/>IIS приймає вебзвернення.<br/>Node.js виконує логіку Аури.',700,333,520,25,MUT)
note('Для власних серверів база може працювати на SQL Server. Принципи обліку зберігаються.');end()
# 10
base(10,'Хто за що відповідає','Захист працює на кількох рівнях, які доповнюють один одного.')
entries=[('Microsoft','Робота хмарних сервісів у межах обраного тарифу та договору.'),('ІТ компанії','Облікові записи, мережа, дозволи, регіон, політики копій і доступу.'),('Команда Аури','Правила обліку, перевірки прав, журнал змін, оновлення застосунку.'),('Власник процесу','Фінансові правила, матриця ролей і приймання результатів пілоту.')]
for i,(a,b) in enumerate(entries):
 y=218+i*91
 text(a,60,y,350,27,BLUE if i%2==0 else TEAL,True)
 text(b,440,y+1,760,25,MUT)
 if i<3:line(60,y+67,1220,y+67,LIGHT,1)
note('Key Vault зберігає технічні секрети. Application Insights допомагає знаходити збої.');end()
# 11
base(11,'Пілот перевірить роботу на практиці','Поточний код - браузерне демо. Серверний пілот потребує окремої реалізації.')
node(58,255,300,150,'Погодити середовище','Azure або власні сервери.<br/>Вхід, база й правила ШІ.')
node(490,255,300,150,'Реалізувати основу','Сервер, доступи, історія.<br/>Рахунки й ручні оплати.')
node(922,255,300,150,'Перевірити пілот','Контрольні суми, права,<br/>звіти та відновлення.',TEAL)
arrow(358,330,490,330);arrow(790,330,922,330)
text('Що потрібно від компанії',60,430,1110,29,INK,True)
text('Відповідальний від ІТ і власник фінансового процесу.<br/>Зразки бюджетів та рахунків, пілотна група й критерії успіху.',60,479,1140,27,MUT)
note('Інтеграція з бухгалтерією та агент у Copilot плануються після узгодженого першого обсягу.');end()
# 12
base(12,'Стек в одному погляді','Назва технології та її роль для працівника й бізнесу.')
items=[('Teams / браузер','Де працівник відкриває Ауру'),('Microsoft Entra ID','Як система перевіряє особу'),('React + TypeScript / Fluent UI','З чого створюють екрани'),('Node.js + TypeScript','Де виконуються правила обліку'),('Azure SQL / SQL Server','Де зберігаються спільні дані'),('Azure App Service / IIS','Де працює застосунок'),('Azure OpenAI','Що допомагає зрозуміти питання')]
for i,(a,b) in enumerate(items):
 y=197+i*42
 text(a,60,y,570,22,BLUE,True);text(b,670,y,550,22,INK)
line(60,510,1220,510,LIGHT,1)
text('Джерела',60,528,150,17,INK,True)
text('Робоча концепція Microsoft-стеку в матеріалах Аури 6. Офіційні пояснення Microsoft:',60,559,1150,16,MUT)
links=[('Entra ID: корпоративний вхід','https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/understand-microsoft-sso-model'),('Azure SQL: база даних','https://learn.microsoft.com/en-us/azure/azure-sql/database/sql-database-paas-overview'),('App Service: розміщення','https://learn.microsoft.com/en-us/azure/app-service/overview'),('Azure OpenAI: дані й приватність','https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy')]
for i,(label,url) in enumerate(links):
 x=60+(i%2)*610;y=590+(i//2)*28
 text(label,x,y,565,16,BLUE)
 c.linkURL(url,(x,H-y-22,x+560,H-y),relative=0)
end();c.save();print(OUT)

