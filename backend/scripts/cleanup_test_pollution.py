"""
One-time cleanup: remove leftover test-fixture rows that were accidentally
written into the REAL application database before tests/conftest.py was
fixed to use an isolated "<db>_test" database.

This does NOT touch real discovered content, real users, or real saved
records. It only removes rows that exactly match the known test-fixture
signatures (e.g. the "API Saved Article" content item created by
tests/test_saved.py::test_saved_api_endpoints, and its companion
"API Source" content source).

Run from backend/ with the real DATABASE_URL configured (same as the app):
    python -m scripts.cleanup_test_pollution
"""
from app.core.database import SessionLocal
from app.models.content_item import ContentItem
from app.models.content_source import ContentSource
from app.models.saved_content import SavedContent
from app.models.user import User

# Known test-fixture signatures introduced by the (now-fixed) test suite.
POLLUTED_CONTENT_ITEM_TITLES = ["API Saved Article", "Saved Article Test", "Isolated Repo"]
POLLUTED_CONTENT_SOURCE_NAMES = ["API Source", "Test Source"]
POLLUTED_USERNAMES = ["saved_api_user", "save_user", "user_a", "user_b"]


def main() -> None:
    db = SessionLocal()
    try:
        items = (
            db.query(ContentItem)
            .filter(ContentItem.title.in_(POLLUTED_CONTENT_ITEM_TITLES))
            .all()
        )
        item_ids = [i.id for i in items]
        if item_ids:
            # saved_content rows cascade automatically via FK ondelete=CASCADE,
            # but we remove them explicitly first for a clear audit trail.
            deleted_saved = (
                db.query(SavedContent)
                .filter(SavedContent.content_item_id.in_(item_ids))
                .delete(synchronize_session=False)
            )
            print(f"Removed {deleted_saved} leftover saved_content record(s).")

        deleted_items = (
            db.query(ContentItem)
            .filter(ContentItem.title.in_(POLLUTED_CONTENT_ITEM_TITLES))
            .delete(synchronize_session=False)
        )
        print(f"Removed {deleted_items} leftover content_item(s): {POLLUTED_CONTENT_ITEM_TITLES}")

        deleted_sources = (
            db.query(ContentSource)
            .filter(ContentSource.name.in_(POLLUTED_CONTENT_SOURCE_NAMES))
            .delete(synchronize_session=False)
        )
        print(f"Removed {deleted_sources} leftover content_source(s): {POLLUTED_CONTENT_SOURCE_NAMES}")

        deleted_users = (
            db.query(User)
            .filter(User.username.in_(POLLUTED_USERNAMES))
            .delete(synchronize_session=False)
        )
        print(f"Removed {deleted_users} leftover test user(s): {POLLUTED_USERNAMES}")

        db.commit()
        print("Cleanup complete. Real content, users, and saved records were not touched.")
    finally:
        db.close()


if __name__ == "__main__":
    main()