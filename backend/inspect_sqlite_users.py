"""Inspect SQLite users table"""
import sqlite3

def main():
    conn = sqlite3.connect('test.db')
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(users);")
    rows = cursor.fetchall()
    print("--- SQLite users table columns ---")
    for row in rows:
        print(f"Column: {row[1]} | Type: {row[2]}")

if __name__ == '__main__':
    main()
