import GuidePage from "@/components/site/SiteChrome";
export default function Loading() {
  return (
    <GuidePage
      kicker="EVANGEL"
      title="Gathering the latest."
      description="Loading the page and checking its connections."
    >
      <p role="status">Please wait…</p>
    </GuidePage>
  );
}
