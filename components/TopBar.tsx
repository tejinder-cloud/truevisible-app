import Link from "next/link";

export function TopBar({ email, trialDays }: { email?: string | null; trialDays?: number | null }) {
  return (
    <header className="topbar">
      <div className="container">
        <Link href="/" className="wordmark">
          TrueVisible<small>by The Growth Lab</small>
        </Link>
        {email ? (
          <div className="account small">
            {trialDays != null && (trialDays > 0
              ? <span className="chip">Trial · {trialDays} {trialDays === 1 ? "day" : "days"} left</span>
              : <a className="chip" href="/dashboard/upgrade">Trial ended · Upgrade</a>)}
            <span className="muted email" title={email}>{email}</span>
            <form action="/auth/signout" method="post">
              <button className="btn-link" type="submit">Sign out</button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  );
}
