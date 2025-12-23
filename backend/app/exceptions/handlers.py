"""
Единое место для настройки обработчиков ошибок FastAPI.

Задачи:
- Привести ответы об ошибках к единому JSON-формату.
- Спрятать внутренние трассировки от конечного пользователя.
- Логировать неожиданные ошибки для дальнейшей диагностики.
"""

from typing import Optional, Any, Dict
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


def _build_error_payload(
    status_code: int,
    message: str,
    code: Optional[str] = None,
    details: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Единый формат ошибки для всех ответов backend.

    Пример:
    {
        "error": {
            "status": 400,
            "code": "BAD_REQUEST",
            "message": "Текст для генерации пустой",
            "details": {...}
        }
    }
    """
    return {
        "error": {
            "status": status_code,
            "code": code,
            "message": message,
            "details": details,
        }
    }


async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    """
    Обработчик "обычных" HTTP-ошибок (HTTPException).

    Все raise HTTPException(...) из кода приложения
    будут проходить через этот обработчик.
    """
    # Можно при желании логировать только 5xx
    if exc.status_code >= 500:
        logger.exception(
            "Unhandled HTTP exception [%s]: %s %s",
            exc.status_code,
            request.method,
            request.url,
        )

    payload = _build_error_payload(
        status_code=exc.status_code,
        message=str(exc.detail),
        code="HTTP_EXCEPTION",
        details=None,
    )
    return JSONResponse(status_code=exc.status_code, content=payload)


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """
    Обработка ошибок валидации входных данных (Pydantic/FastAPI).

    Например, если в body не хватает обязательного поля.
    """
    logger.warning(
        "Validation error on %s %s: %s",
        request.method,
        request.url,
        exc.errors(),
    )

    payload = _build_error_payload(
        status_code=422,
        message="Ошибка валидации входных данных",
        code="VALIDATION_ERROR",
        details=exc.errors(),
    )
    return JSONResponse(status_code=422, content=payload)


async def generic_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """
    "Последняя линия защиты" — перехватывает любые необработанные исключения.
    Пользователь видит аккуратный 500-ответ, а детали ошибки уходят в лог.
    """
    # ✅ FIX: match placeholders with provided args
    # logging uses %-formatting internally; mismatch causes TypeError.  :contentReference[oaicite:2]{index=2}
    logger.exception(
        "Unexpected error while handling request %s %s: %r",
        request.method,
        request.url,
        exc,
    )

    payload = _build_error_payload(
        status_code=500,
        message="Внутренняя ошибка сервера. Попробуйте ещё раз позже.",
        code="INTERNAL_SERVER_ERROR",
        details=None,
    )
    return JSONResponse(status_code=500, content=payload)


def init_exception_handlers(app: FastAPI) -> None:
    """
    Регистрируем все обработчики ошибок на уровне приложения FastAPI.
    Вызывается один раз из backend/app/main.py.
    """
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
