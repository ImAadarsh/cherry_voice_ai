import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { getOmnidim } from "@/lib/omnidim";
import { resolveAgentMapping } from "@/lib/repositories/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WidgetConfig = {
  title?: string;
  logoUrl?: string;
  position?: string;
  iframeUrl?: string;
  textColor?: string;
  background?: string;
  widgetType?: string;
  iframeWidth?: string;
  iframeHeight?: string;
  voiceWidgetStyle?: string;
};

/** GET /api/omnidim/web-calls/embed?agent_id= — widget iframe embed code for an agent. */
export async function GET(req: Request) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  const agentRef = new URL(req.url).searchParams.get("agent_id");
  if (!agentRef) return fail("agent_id is required", 422);

  const mapping = await resolveAgentMapping(restaurantId, agentRef);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  try {
    const agent = (await omnidim.agents.get(mapping.omnidim_agent_id)) as {
      name?: string;
      secret_key?: string;
      widget_config?: WidgetConfig;
    };

    const widget = agent.widget_config ?? {};
    const secret = agent.secret_key;
    const iframeUrl =
      widget.iframeUrl ??
      (secret ? `https://app.omnidim.io/chat-widget?secret=${secret}` : null);

    const width = widget.iframeWidth ?? "350px";
    const height = widget.iframeHeight ?? "550px";
    const title = widget.title ?? agent.name ?? mapping.name;

    const embedHtml = iframeUrl
      ? `<iframe
  src="${iframeUrl}"
  title="${title}"
  width="${width}"
  height="${height}"
  style="border:0;border-radius:12px;"
  allow="microphone"
></iframe>`
      : null;

    const scriptEmbed = iframeUrl
      ? `<!-- Cherry Voice AI · Website voice widget -->
<div id="cherry-voice-widget"></div>
<script>
  (function () {
    var iframe = document.createElement("iframe");
    iframe.src = "${iframeUrl}";
    iframe.title = "${title}";
    iframe.width = "${width.replace("px", "")}";
    iframe.height = "${height.replace("px", "")}";
    iframe.style.cssText = "border:0;border-radius:12px;";
    iframe.allow = "microphone";
    document.getElementById("cherry-voice-widget").appendChild(iframe);
  })();
</script>`
      : null;

    return ok({
      agent: { id: mapping.omnidim_agent_id, name: mapping.name },
      widget_config: widget,
      iframe_url: iframeUrl,
      embed_html: embedHtml,
      embed_script: scriptEmbed,
      available: Boolean(iframeUrl),
    });
  } catch (err) {
    return fail(`Failed to load widget embed: ${(err as Error).message}`, 502);
  }
}
