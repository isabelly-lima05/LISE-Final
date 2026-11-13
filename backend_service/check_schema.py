"""Read-only deployment check: python check_schema.py. Never applies SQL."""
from sqlalchemy import inspect
from app import create_app
from backend.models import Base

def missing_schema(engine):
    inspector=inspect(engine); missing=[]
    for table in Base.metadata.sorted_tables:
        if not inspector.has_table(table.name,schema=table.schema):
            missing.append(f'{table.name}: tabela ausente');continue
        actual={c['name'] for c in inspector.get_columns(table.name,schema=table.schema)}
        missing.extend(f'{table.name}.{c.name}: coluna ausente' for c in table.columns if c.name not in actual)
    return missing

def main():
    try: missing=missing_schema(create_app().extensions['engine'])
    except Exception as error:
        print(f'Falha na verificação ({type(error).__name__}). Confira as variáveis do backend. Nenhum dado alterado.');return 2
    if missing:
        print('ESQUEMA INCOMPATÍVEL — confira as migrações antes de publicar:\n'+'\n'.join(missing));return 1
    print('OK: tabelas e colunas existem. Esta verificação não testa RLS, constraints, Auth ou conteúdo.');return 0

if __name__=='__main__':raise SystemExit(main())
