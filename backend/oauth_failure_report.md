# OAuth Failure Report (Phase 0)

This report details the exact failure captured during the `POST /api/v1/auth/sync-oauth` request.

## HTTP Status
`500 Internal Server Error`

## Exception Type
`sqlalchemy.exc.ProgrammingError` wrapping `asyncpg.exceptions.UndefinedColumnError`

## File
`c:\Users\harsh\face new\facesnap\backend\app\routes\auth.py`

## Line Number
Line `454`: `result = await db.execute(select(User).where(User.id == payload.id))`

## Full Traceback
```text
Traceback (most recent call last):
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\dialects\postgresql\asyncpg.py", line 526, in _prepare_and_execute
    prepared_stmt, attributes = await adapt_connection._prepare(
                                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\dialects\postgresql\asyncpg.py", line 773, in _prepare
    prepared_stmt = await self._connection.prepare(
                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\asyncpg\connection.py", line 638, in prepare
    return await self._prepare(
           ^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\asyncpg\connection.py", line 657, in _prepare
    stmt = await self._get_statement(
           ^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\asyncpg\connection.py", line 443, in _get_statement
    statement = await self._protocol.prepare(
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "asyncpg/protocol/protocol.pyx", line 165, in prepare
asyncpg.exceptions.UndefinedColumnError: column users.platform_role does not exist

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\engine\base.py", line 1967, in _exec_single_context
    self.dialect.do_execute(
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\engine\default.py", line 952, in do_execute
    cursor.execute(statement, parameters)
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\dialects\postgresql\asyncpg.py", line 585, in execute
    self._adapt_connection.await_(
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\util\_concurrency_py3k.py", line 132, in await_only
    return current.parent.switch(awaitable)  # type: ignore[no-any-return,attr-defined] # noqa: E501
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\util\_concurrency_py3k.py", line 196, in greenlet_spawn
    value = await result
            ^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\dialects\postgresql\asyncpg.py", line 563, in _prepare_and_execute
    self._handle_exception(error)
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\dialects\postgresql\asyncpg.py", line 513, in _handle_exception
    self._adapt_connection._handle_exception(error)
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\dialects\postgresql\asyncpg.py", line 797, in _handle_exception
    raise translated_error from error
sqlalchemy.dialects.postgresql.asyncpg.AsyncAdapt_asyncpg_dbapi.ProgrammingError: <class 'asyncpg.exceptions.UndefinedColumnError'>: column users.platform_role does not exist

The above exception was the direct cause of the_following exception:

Traceback (most recent call last):
  File "C:\Users\harsh\face new\facesnap\backend\app\routes\auth.py", line 454, in sync_oauth
    result = await db.execute(select(User).where(User.id == payload.id))
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\ext\asyncio\session.py", line 449, in execute
    result = await greenlet_spawn(
             ^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\util\_concurrency_py3k.py", line 201, in greenlet_spawn
    result = context.throw(*sys.exc_info())
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\orm\session.py", line 2351, in execute
    return self._execute_internal(
           ^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\orm\session.py", line 2249, in _execute_internal
    result: Result[Any] = compile_state_cls.orm_execute_statement(
                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\orm\context.py", line 306, in orm_execute_statement
    result = conn.execute(
             ^^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\engine\base.py", line 1419, in execute
    return meth(
           ^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\sql\elements.py", line 527, in _execute_on_connection
    return connection._execute_clauseelement(
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\engine\base.py", line 1641, in _execute_clauseelement
    ret = self._execute_context(
          ^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\engine\base.py", line 1846, in _execute_context
    return self._exec_single_context(
           ^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\engine\base.py", line 1986, in _exec_single_context
    self._handle_dbapi_exception(
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\engine\base.py", line 2363, in _handle_dbapi_exception
    raise sqlalchemy_exception.with_traceback(exc_info[2]) from e
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\engine\base.py", line 1967, in _exec_single_context
    self.dialect.do_execute(
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\engine\default.py", line 952, in do_execute
    cursor.execute(statement, parameters)
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\dialects\postgresql\asyncpg.py", line 585, in execute
    self._adapt_connection.await_(
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\util\_concurrency_py3k.py", line 132, in await_only
    return current.parent.switch(awaitable)  # type: ignore[no-any-return,attr-defined] # noqa: E501
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\util\_concurrency_py3k.py", line 196, in greenlet_spawn
    value = await result
            ^^^^^^^^^^^^
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\dialects\postgresql\asyncpg.py", line 563, in _prepare_and_execute
    self._handle_exception(error)
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\dialects\postgresql\asyncpg.py", line 513, in _handle_exception
    self._adapt_connection._handle_exception(error)
  File "C:\Users\harsh\AppData\Local\Programs\Python\Python312\Lib\site-packages\sqlalchemy\dialects\postgresql\asyncpg.py", line 797, in _handle_exception
    raise translated_error from error
sqlalchemy.exc.ProgrammingError: (sqlalchemy.dialects.postgresql.asyncpg.ProgrammingError) <class 'asyncpg.exceptions.UndefinedColumnError'>: column users.platform_role does not exist
```
