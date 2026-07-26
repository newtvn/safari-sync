"""
Mobile-money / card provider abstraction.

Mirrors the sibling GoalHub project's pattern: a unified interface with a
sandbox simulation mode, so the rest of the app never has to know whether a
payment is real or simulated. To go live for a given provider, implement the
`_real_*` branch with that provider's actual API (Safaricom Daraja for
M-Pesa, MTN MoMo Collections API, Airtel Money Merchant API) and flip
PAYMENT_SANDBOX=false with real credentials in the environment. No such
production credentials exist in this environment, so every provider below
runs in simulate mode: it accepts the request, "pushes" a prompt (logged,
not sent), and a background task approves it after a short delay - the same
shape a real STK push / MoMo collection approval would have.
"""

import logging

from .config import settings

logger = logging.getLogger("safarisync.payments")


class ProviderResult:
    def __init__(self, accepted: bool, provider_ref: str, message: str):
        self.accepted = accepted
        self.provider_ref = provider_ref
        self.message = message


async def initiate_payment(provider: str, phone: str, amount: float, checkout_request_id: str) -> ProviderResult:
    if settings.payment_sandbox:
        logger.info(
            "\U0001F4B3 [SANDBOX] %s prompt sent to %s for $%.2f (ref=%s)",
            provider, phone or "card", amount, checkout_request_id,
        )
        return ProviderResult(
            accepted=True,
            provider_ref=f"SANDBOX-{checkout_request_id[-8:]}",
            message="Simulated prompt sent - approves automatically in sandbox mode.",
        )

    if provider == "mpesa":
        raise NotImplementedError(
            "Set MPESA_CONSUMER_KEY/SECRET and implement the Daraja STK Push call here to go live."
        )
    if provider == "mtn":
        raise NotImplementedError(
            "Set MTN_API_KEY and implement the MTN MoMo Collections request-to-pay call here to go live."
        )
    if provider == "airtel":
        raise NotImplementedError(
            "Set AIRTEL_API_KEY and implement the Airtel Money collection call here to go live."
        )
    if provider == "card":
        raise NotImplementedError("Wire a real card processor (e.g. a hosted checkout) here to go live.")

    raise ValueError(f"Unknown payment provider: {provider}")
