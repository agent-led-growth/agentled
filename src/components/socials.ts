/**
 * Footer social links, rendered as text (name + external-link arrow), not logos.
 * Order here is the display order in the footer's "Follow" group.
 */

export type Social = {
  name: string;
  href: string;
};

export const SOCIALS: Social[] = [
  { name: "X", href: "https://x.com/hsantana8" },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/hugosantana8/" },
  { name: "YouTube", href: "https://www.youtube.com/@agent-led-growth" },
  { name: "Substack", href: "https://agentledco.substack.com" },
  { name: "GitHub", href: "https://github.com/agent-led-growth" },
];
