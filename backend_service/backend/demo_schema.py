"""Additive upgrades for the local SQLite demo only; never run against PostgreSQL."""
from sqlalchemy import inspect,text

COLUMNS={
 'termos':{'revisao':'INTEGER NOT NULL DEFAULT 1'},
 'turmas':{'arquivada_em':'DATETIME','matriculas_abertas':'BOOLEAN NOT NULL DEFAULT 1','revisao':'INTEGER NOT NULL DEFAULT 1'},
 'trilhas':{'arquivada_em':'DATETIME','revisao':'INTEGER NOT NULL DEFAULT 1'},
 'trilha_termos':{'ordem':'INTEGER NOT NULL DEFAULT 0'},
 'turma_trilha':{'desvinculada_em':'DATETIME','revisao':'INTEGER NOT NULL DEFAULT 1'},
 'lise_colecoes':{'revisao':'INTEGER NOT NULL DEFAULT 1'},
 'lise_sessoes':{'dispositivo':"VARCHAR(200) NOT NULL DEFAULT ''",'ultimo_uso_em':'DATETIME'},
 'lise_avaliacoes':{'revisao':'INTEGER NOT NULL DEFAULT 1','janela_versao':'INTEGER NOT NULL DEFAULT 1','historico_janelas':"JSON NOT NULL DEFAULT '[]'"},
 'lise_avaliacao_sessoes':{'janela_versao':'INTEGER NOT NULL DEFAULT 1'},
}


def upgrade_demo_schema(engine):
    if engine.dialect.name!='sqlite':raise RuntimeError('Atualização de demonstração restrita ao SQLite.')
    with engine.begin() as conn:
        for table,fields in COLUMNS.items():
            current={c['name'] for c in inspect(conn).get_columns(table)}
            for name,definition in fields.items():
                if name not in current:conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{name}" {definition}'))
        conn.execute(text('UPDATE lise_sessoes SET ultimo_uso_em=CURRENT_TIMESTAMP WHERE ultimo_uso_em IS NULL'))
        conn.execute(text('UPDATE trilha_termos SET ordem=id WHERE ordem=0'))
