"use client";
import GuidePage from "@/components/site/SiteChrome";
export default function ErrorPage({ retry, reset }) {
  return (
    <GuidePage
      kicker="PAGE UNAVAILABLE"
      title="Let’s try that again."
      description="We couldn’t load this page. Check your connection and retry. If you submitted a transaction, verify its status in your wallet before submitting another."
    >
      <button className="ev-button" onClick={() => (retry || reset)?.()}>
        Try again
      </button>
    </GuidePage>
  );
}
