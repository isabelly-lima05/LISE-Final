"""Export the real legal templates to readable Markdown without contacting Supabase."""
import re
import secrets
import sys
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend_service'))
from app import create_app
from backend.privacy_api import LEGAL_VERSION


class Markdown(HTMLParser):
    def __init__(self):super().__init__();self.out=[];self.links=[];self.in_table=False;self.rows=[];self.row=[];self.cell=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='table':self.in_table=True;self.rows=[];return
        if self.in_table:
            if tag=='tr':self.row=[]
            if tag in ('td','th'):self.cell=[]
            return
        if tag=='h2':self.out.append('\n\n## ')
        elif tag=='p':self.out.append('\n\n')
        elif tag=='a':self.links.append((len(self.out),attrs.get('href','')));self.out.append('[')
        elif tag=='br':self.out.append('\n')
    def handle_endtag(self,tag):
        if self.in_table:
            if tag in ('td','th'):self.row.append(''.join(self.cell).strip().replace('|','\\|'))
            if tag=='tr':self.rows.append(self.row)
            if tag=='table':
                self.in_table=False
                if self.rows:self.out.append('\n\n'+'\n'.join('| '+' | '.join(row)+' |'+('\n| '+' | '.join('---' for _ in row)+' |' if i==0 else '') for i,row in enumerate(self.rows)))
            return
        if tag=='a' and self.links:
            _,href=self.links.pop();self.out.append(']('+href+')')
        if tag in ('h2','p'):self.out.append('\n\n')
    def handle_data(self,text):
        if self.in_table:self.cell.append(text)
        elif text.strip():self.out.append(text)


def main():
    out=ROOT.parents[1]/'docs'/'documentos';out.mkdir(parents=True,exist_ok=True)
    app=create_app({'DEMO_MODE':True,'DATABASE_URL':'sqlite:///:memory:','SECRET_KEY':secrets.token_hex(32),
                    'PRIVACY_PUBLICATION_READY':False,'PRIVACY_CONTROLLER':'','PRIVACY_EMAIL':'john.cristopher.senai@gmail.com'})
    client=app.test_client()
    for route,name in [('privacidade','PRIVACIDADE'),('termos-de-uso','TERMOS_DE_USO'),('cookies','COOKIES')]:
        response=client.get('/api/v1/legal/'+route);assert response.status_code==200
        data=response.json;parser=Markdown();parser.feed(data['html']);text=re.sub(r'\n{3,}','\n\n',''.join(parser.out)).strip()
        (out/(name+'.md')).write_text(f'# {data["title"]}\n\nVersão `{LEGAL_VERSION}` — em revisão. Cópia gerada do template utilizado pela aplicação.\n\n'+text+'\n',encoding='utf-8')
    print('Documentos exportados para docs/documentos; sem acesso a serviços externos.')

if __name__=='__main__':main()
