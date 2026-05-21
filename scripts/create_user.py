"""Provision a doctor or receptionist account out-of-band.

Examples:
    python scripts/create_user.py --role doctor --mobile 9812345678 --name "Dr. Sharma" --clinic "Sharma Homeopathy"
    python scripts/create_user.py --role receptionist --mobile 9876543210 --name "Asha" --clinic-id 1
    python scripts/create_user.py --reset --mobile 9812345678          # generate a new password

If --password is omitted, a random 12-char password is generated and printed once.
"""

from __future__ import annotations

import argparse
import secrets
import string
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlmodel import Session, select  # noqa: E402

from app.db import engine  # noqa: E402
from app.models import Clinic, User, UserRole  # noqa: E402
from app.services.auth import hash_password, normalize_mobile  # noqa: E402
from app.services.cred_ledger import record_credential  # noqa: E402


def random_password(n: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--mobile", required=True)
    p.add_argument("--name")
    p.add_argument("--role", choices=[r.value for r in UserRole], default=UserRole.doctor.value)
    p.add_argument("--clinic")
    p.add_argument("--clinic-id", type=int)
    p.add_argument("--password")
    p.add_argument("--reset", action="store_true", help="Reset password for an existing user")
    args = p.parse_args()

    mobile = normalize_mobile(args.mobile)
    if not mobile:
        print(f"Invalid mobile: {args.mobile!r}", file=sys.stderr)
        return 2

    password = args.password or random_password()

    with Session(engine) as db:
        if args.reset:
            user = db.exec(select(User).where(User.mobile == mobile)).first()
            if not user:
                print(f"No user found with mobile {mobile}", file=sys.stderr)
                return 1
            user.password_hash = hash_password(password)
            user.active = True
            db.add(user)
            db.commit()
            record_credential(
                clinic_id=user.clinic_id, user_id=user.id, name=user.name, mobile=user.mobile,
                role=user.role.value, password=password, event="reset",
            )
            print(f"Password reset for {user.name} ({user.mobile}).")
            print(f"New password: {password}")
            return 0

        if args.clinic_id:
            clinic = db.get(Clinic, args.clinic_id)
            if not clinic:
                print(f"No clinic with id {args.clinic_id}", file=sys.stderr)
                return 1
        elif args.clinic:
            clinic = Clinic(name=args.clinic)
            db.add(clinic)
            db.commit()
            db.refresh(clinic)
            print(f"Created clinic '{clinic.name}' (id={clinic.id}).")
        else:
            print("Provide --clinic <name> for a new clinic or --clinic-id <id>.", file=sys.stderr)
            return 2

        if not args.name:
            print("Provide --name", file=sys.stderr)
            return 2

        existing = db.exec(
            select(User).where(User.clinic_id == clinic.id, User.mobile == mobile)
        ).first()
        if existing:
            print(f"User with mobile {mobile} already exists in clinic {clinic.id}.", file=sys.stderr)
            return 1

        user = User(
            clinic_id=clinic.id,
            role=UserRole(args.role),
            mobile=mobile,
            password_hash=hash_password(password),
            name=args.name,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        record_credential(
            clinic_id=clinic.id, user_id=user.id, name=user.name, mobile=user.mobile,
            role=user.role.value, password=password, event="provisioned",
        )
        print(f"Created {user.role.value} '{user.name}' (mobile={user.mobile}) in clinic {clinic.id}.")
        print(f"Password: {password}")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
