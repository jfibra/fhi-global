"use client"

// Section 03 of the Team Performance Report: from joining to the first sale. The story it tells a
// team leader: the funnel (where recruits drop out), who can fix what (the RECRUITER approves and sets
// the role on their Invite page; the RECRUIT finishes their own profile and photo), which recruiters have
// people waiting, and the definition of "finished all the requirements". Facts checked in the code:
// only the direct inviter (or an admin) can approve a recruit and change their role; the Team invite
// link registers everyone as Member, which cannot sell.

import { StatTiles } from "@/features/dashboard/fhi-chat/charts"
import { UserAvatar } from "@/components/user-avatar"
import type { Requirement, TeamReport } from "@/lib/team-report/data"
import { REQUIREMENT_HINTS, REQUIREMENT_KEYS, REQUIREMENT_LABELS, REQUIREMENT_NOTE, REQUIREMENT_OWNERS } from "@/lib/team-report/labels"
import { Funnel, RankedBars, ShowAll } from "./team-report-charts"
import { Block, Label, Notice, People, fmtDay, num, roleText, tile } from "./team-report-ui"
import { SECTIONS, type Verdict } from "./team-report-verdicts"

const section = SECTIONS.find((s) => s.key === "recruits")!

const chip = (dark: boolean) => `rounded-full px-2.5 py-1 text-[13px] font-bold ${dark ? "bg-[#001f3f] text-white" : "bg-[#e5e9f0] text-[#1f2937]"}`

export function RecruitsSection({ r, verdict }: { r: TeamReport; verdict: Verdict }) {
  const R = r.recruitment
  const miss = (k: Requirement) => R.missing.find((m) => m.label === REQUIREMENT_LABELS[k])?.value ?? 0
  const readyNew = R.funnel[2]?.value ?? 0
  const validatedNew = R.funnel[4]?.value ?? 0
  const waiting = R.recruiters.filter((g) => g.waitingApproval + g.waitingRole + g.profileOrPhoto > 0)

  return (
    <Block id="recruits" n={section.n} title={section.title} subtitle="Who joined, and how far each recruit got — a recruit can only record a sale once every requirement is done." verdict={verdict}>
      <StatTiles
        size="lg"
        stats={[
          tile("New recruits", String(R.recruited), `before: ${R.previous}`, R.change),
          tile("Via team invite links", String(R.viaTeamInvite), "registered under a team member"),
          tile("Ready to sell", `${readyNew} of ${R.recruited}`, "finished every requirement"),
          tile("Validated a first sale", `${validatedNew} of ${R.recruited}`, "counts on the leaderboard"),
        ]}
      />

      {r.outsideTeam && (
        <Notice tone="alert" title={`${num(r.outsideTeam.total)} recruit${r.outsideTeam.total === 1 ? " is" : "s are"} not on the team list yet`}>
          <p>
            They are in the invite network of {r.outsideTeam.recruiters.join(" & ")} — {num(r.outsideTeam.active)} approved, {num(r.outsideTeam.pending)} waiting for Approve, {num(r.outsideTeam.withoutSellingRole)} without a selling role — but they were never added to the team.
            Team Sales, the leaderboards and this report do not count them yet, and any sales they make are not included.
          </p>
          <p className="mt-2 font-semibold">An admin can add them in Teams &gt; Add member. The ones still waiting need Approve on Invite &gt; Team.</p>
          {r.outsideTeam.waiting.length > 0 && (
            <p className="mt-2 text-[14px] text-[#374151]">
              Waiting for Approve: {r.outsideTeam.waiting.slice(0, 6).map((w) => w.name).join(", ")}
              {r.outsideTeam.pending > 6 ? ` and ${r.outsideTeam.pending - 6} more` : ""}.
            </p>
          )}
        </Notice>
      )}

      {R.recruited > 0 ? (
        <>
          <div className="rounded-xl border border-[#dfe3e9] p-5">
            <Label right="recruits of this period">From joining to the first sale</Label>
            <Funnel steps={R.funnel} />
          </div>

          <div>
            <Label>Who can fix what</Label>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border-2 border-[#001f3f] bg-white p-5">
                <h5 className="font-['Outfit'] text-[20px] font-bold text-[#001f3f]">The recruiter can fix today</h5>
                <p className="mt-0.5 text-[15px] text-[#4b5563]">Only the person whose invite link the recruit used can press Approve and set the role.</p>
                <ul className="mt-4 space-y-4">
                  {(["approved", "selling_role"] as const).map((k) => (
                    <li key={k} className="flex items-start gap-4">
                      <span className="w-14 shrink-0 font-['Outfit'] text-[34px] font-bold leading-none tabular-nums text-[#001f3f]">{miss(k)}</span>
                      <span className="text-[16px] leading-snug text-[#0d1117]">
                        {k === "approved" ? <>waiting for <b>Approve</b></> : <>without a selling role — still <b>Member</b></>}
                        <span className="mt-0.5 block text-[14px] text-[#4b5563]">{REQUIREMENT_OWNERS[k].where}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-[#cfd5de] bg-[#f8f9fb] p-5">
                <h5 className="font-['Outfit'] text-[20px] font-bold text-[#1f2937]">The recruits do these themselves</h5>
                <p className="mt-0.5 text-[15px] text-[#4b5563]">Ask them on WhatsApp — nobody else can do it for them.</p>
                <ul className="mt-4 space-y-4">
                  {(["profile", "photo"] as const).map((k) => (
                    <li key={k} className="flex items-start gap-4">
                      <span className="w-14 shrink-0 font-['Outfit'] text-[34px] font-bold leading-none tabular-nums text-[#374151]">{miss(k)}</span>
                      <span className="text-[16px] leading-snug text-[#0d1117]">
                        {k === "profile" ? <>profile not finished</> : <>without a profile photo</>}
                        <span className="mt-0.5 block text-[14px] text-[#4b5563]">{REQUIREMENT_OWNERS[k].where}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-2 text-[14px] text-[#4b5563]">A recruit can be missing more than one thing, so these numbers overlap.</p>
          </div>

          <div>
            <Label right="only the recruiter can press Approve and set the role">Who has recruits waiting</Label>
            {waiting.length ? (
              <ShowAll
                rows={waiting}
                total={waiting.length}
                noun="recruiters"
                render={(rows) => (
                  <ul className="divide-y divide-[#eef0f3] overflow-hidden rounded-xl border border-[#dfe3e9]">
                    {rows.map((g) => (
                      <li key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                        <UserAvatar name={g.name} imageUrl={g.photo} size={38} />
                        <div className="min-w-0 flex-1 basis-48">
                          <p className="text-[16px] font-bold leading-snug text-[#0d1117]">
                            {g.name}
                            {!g.onTeam && g.id !== "direct" && <span className="ml-2 rounded-full bg-[#fdf3d8] px-2 py-0.5 align-middle text-[12px] font-bold text-[#713f12]">outside the team</span>}
                          </p>
                          <p className="text-[14px] text-[#4b5563]">{g.recruits} recruit{g.recruits === 1 ? "" : "s"} · {g.ready} ready</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {g.waitingApproval > 0 && <span className={chip(true)}>{g.waitingApproval} to Approve</span>}
                          {g.waitingRole > 0 && <span className={chip(true)}>{g.waitingRole} need a selling role</span>}
                          {g.profileOrPhoto > 0 && <span className={chip(false)}>{g.profileOrPhoto} profile / photo</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              />
            ) : (
              <p className="rounded-xl border border-dashed border-[#c5ccd6] px-4 py-6 text-center text-[16px] text-[#374151]">Nobody has recruits waiting — every recruit is approved and has a role, a profile and a photo.</p>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-[#dfe3e9] p-5">
              <Label>Recruits still missing…</Label>
              <RankedBars tone="blue" rows={R.missing.map((m) => ({ label: m.label, value: m.value, display: num(m.value) }))} />
            </div>
            <div className="rounded-xl border border-[#dfe3e9] p-5">
              <Label>Their account role today</Label>
              <RankedBars
                tone="blue"
                rows={R.byAccountRole.map((b) => ({ label: b.label, value: b.value, display: num(b.value), sub: b.label === "Member" ? "Cannot record sales until the recruiter changes the role to Agent" : null }))}
              />
            </div>
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-[#c5ccd6] px-4 py-8 text-center text-[16px] text-[#374151]">No recruits joined the team in {r.period.label}.</p>
      )}

      <div className="rounded-xl border-l-4 border-[#d6b357] bg-[#fffaf0] p-5">
        <h4 className="text-[17px] font-bold text-[#6b5320]">How we count &ldquo;finished all the requirements&rdquo;</h4>
        <ol className="mt-3 space-y-3.5">
          {REQUIREMENT_KEYS.map((k, i) => (
            <li key={k} className="flex gap-3">
              <span className="w-6 shrink-0 font-['Outfit'] text-[22px] font-bold leading-tight text-[#8a6d2a]">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] leading-snug text-[#0d1117]"><b>{REQUIREMENT_LABELS[k]}</b> — {REQUIREMENT_HINTS[k]}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] text-[#374151]">
                  <span className={chip(REQUIREMENT_OWNERS[k].who === "recruiter")}>{REQUIREMENT_OWNERS[k].whoLabel}</span>
                  {REQUIREMENT_OWNERS[k].where}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[14px] leading-relaxed text-[#374151]">{REQUIREMENT_NOTE}</p>
      </div>

      {R.notReady.length > 0 && (
        <div>
          <Label right={`${num(R.notReadyTotal)} recruit${R.notReadyTotal === 1 ? "" : "s"}`}>Not ready yet — finish these first</Label>
          <ShowAll
            rows={R.notReady}
            total={R.notReadyTotal}
            noun="recruits"
            render={(rows) => (
              <People
                rows={rows}
                sub={(m) => `Invited by ${m.invitedBy ? `${m.invitedBy.name}${m.invitedBy.onTeam ? "" : " (outside the team)"}` : "nobody (signed up without a link)"} · joined ${fmtDay(m.joined)}`}
                right={(m) => <span className="text-[14px] font-semibold text-[#991b1b]">Missing: {m.missing.map((k) => REQUIREMENT_LABELS[k].toLowerCase()).join(" · ")}</span>}
              />
            )}
          />
        </div>
      )}

      {R.readyNotSelling.length > 0 && (
        <div>
          <Label right={`${num(R.readyNotSellingTotal)} recruit${R.readyNotSellingTotal === 1 ? "" : "s"}`}>Ready, but no sale recorded — get them their first deal</Label>
          <ShowAll
            rows={R.readyNotSelling}
            total={R.readyNotSellingTotal}
            noun="recruits"
            render={(rows) => (
              <People
                rows={rows}
                sub={(m) => `Invited by ${m.invitedBy?.name ?? "nobody"} · joined ${fmtDay(m.joined)}`}
                right={(m) => <span className="text-[14px] text-[#374151]">{roleText(m.accountRole)}</span>}
              />
            )}
          />
        </div>
      )}
    </Block>
  )
}
