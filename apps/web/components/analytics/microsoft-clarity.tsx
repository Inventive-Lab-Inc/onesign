import { headers } from "next/headers";
import Script from "next/script";
import { getClarityProjectIdForHost } from "@/lib/analytics/clarity";

export function MicrosoftClarity() {
  const projectId = getClarityProjectIdForHost(headers().get("host"));
  if (!projectId) return null;

  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${projectId}");`}
    </Script>
  );
}
