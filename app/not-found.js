import Link from "next/link";
import GuidePage from "@/components/site/SiteChrome";
export default function NotFound() {
  return (
    <GuidePage
      kicker="404 / PAGE NOT FOUND"
      title="This page hasn’t found its community."
      description="The link may have changed. You can get back to the launchpad or explore open-source funding."
    >
      <div className="ev-actions">
        <Link className="ev-button" href="/">
          Explore launches →
        </Link>
        <Link className="ev-link" href="/fund">
          Fund open source
        </Link>
      </div>
    </GuidePage>
  );
}
