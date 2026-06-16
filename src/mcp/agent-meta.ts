/** 
 * TIER1 and profiles removed (no progressive disclosure, no meta registration).
 * The MCP now exposes ONLY 1:1 wrappers for Polymarket SDK methods in publicTools/secureTools.
 * tools/list returns the pure SDK surface immediately. No helper/meta tools.
 */
export const TIER1_CORE_TOOL_NAMES: readonly string[] = [];

/** Profiles removed - no longer used for registration or gating. */
export const AGENT_PROFILES: Record<string, { categories: string[]; description: string }> = {};

export type ToolDef = {
  name: string;
  description?: string;
  inputSchema?: { properties?: Record<string, unknown> };
};

// searchToolDefinitions removed (search_tools meta tool deleted)