import os
from contextlib import contextmanager

import pymysql
from dotenv import load_dotenv

load_dotenv()


def get_conn():
    return pymysql.connect(
        host=os.getenv("NOTECLASS_HOST", "localhost"),
        port=int(os.getenv("NOTECLASS_PORT", "3306")),
        user=os.getenv("NOTECLASS_USER", "root"),
        password=os.getenv("NOTECLASS_PASSWORD", ""),
        database=os.getenv("NOTECLASS_NAME", "noteclass"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,  # linhas viram dicionários
    )


@contextmanager
def cursor():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
