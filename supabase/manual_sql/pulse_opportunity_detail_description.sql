alter table public.pulse_opportunities
add column if not exists detail_description text;

comment on column public.pulse_opportunities.detail_description
is 'Optional rich HTML brief shown on the Pulse opportunity detail page. Short description remains for listing cards.';

update public.pulse_opportunities
set detail_description = '<p><strong>About this opportunity</strong></p><p>Work in a student team on a real market research brief for an early-stage consumer brand. You will map target customers, study competitor positioning, collect quick campus insights, and prepare a recommendation deck that can be added to your portfolio.</p><p><strong>What students will do</strong></p><ul><li>Understand the brand, audience, and market problem.</li><li>Research competing products, pricing, messaging, and positioning.</li><li>Collect quick student or campus-level insights.</li><li>Prepare a concise recommendation deck with findings and next steps.</li></ul><p><strong>Best suited for</strong></p><ul><li>MBA, BBA, commerce, marketing, strategy, consulting, or business analytics students.</li><li>Students who want practical project exposure before interviews.</li><li>Students comfortable with research, structured thinking, and team execution.</li></ul><p><strong>Output expected</strong></p><p>A short market research deck with competitor analysis, customer insight summary, and practical recommendations.</p>'
where title = 'Campus Market Research Sprint for a Consumer Startup'
  and detail_description is null;
