import { C, Code, Lead, List, Note, P, Section, Table } from "../ui";

export default function Week() {
  return (
    <>
      <Lead>
        The home screen, laid out like the diary page: this week’s motivation, the daily habits with seven marks each, then the
        weekly tasks. All rules live in <C>Planner_Flow/src/lib/week.js</C> and <C>dates.js</C>, with tests.
      </Lead>

      <Section id="layout" title="Page layout">
        <List>
          <li><strong>Header</strong>: greeting by time of day (in the user’s time zone), the week across the full width with arrows, and three chips: done today, weekly tasks, best current streak.</li>
          <li><strong>Day strip</strong>: the seven days with a bar each for how many habits were done (✓ when all); today highlighted (<C>dayProgress</C>).</li>
          <li>A 🎉 line when every habit is done today; then motivation, daily habits (with a weekly bar and 🔥 streak per habit) and weekly tasks.</li>
        </List>
      </Section>

      <Section id="weeks" title="1. Weeks and “today”">
        <List>
          <li>Each user picks the day weeks start on (Monday by default) and has a time zone (India by default).</li>
          <li>“Today” is worked out in the user’s time zone, so a new week starts at midnight in India even while it’s still Sunday in UTC.</li>
          <li>A week is identified by its first day, written <C>YYYY-MM-DD</C>. The title reads “Plan for 12 Oct – 18 Oct”; arrows move a week at a time.</li>
          <li>At midnight on the first day of a new week the screen moves to it by itself.</li>
        </List>
      </Section>

      <Section id="habits" title="2. Daily habits and marks">
        <P>
          A habit has a start day and, if stopped, a stop day. It shows in every week where it existed for at least one day, so
          new weeks carry the previous week’s habits automatically. “Stop tracking from this week on” keeps it in earlier weeks;
          “Delete” removes it everywhere.
        </P>
        <Table
          head={["Cell", "Looks like", "Meaning"]}
          rows={[
            ["done", "straight navy line", "Marked done"],
            ["missed", "red zigzag", "Marked missed"],
            ["lapsed", "faint dashed zigzag", "A past day nobody marked: counts as missed, can still be fixed"],
            ["open", "highlighted empty cell", "Today, not marked yet"],
            ["future", "dotted line, not tappable", "Later this week"],
            ["none", "nothing at all", "The habit didn’t exist yet that day"],
          ]}
        />
        <Code>{`tap: unmarked/lapsed ──► done ──► missed ──► unmarked`}</Code>
        <List>
          <li>A mark’s id is <C>habitId_date</C>, so two phones marking the same day edit the same record.</li>
          <li>Clearing a mark stores a deletion (tombstone) so other devices clear it too.</li>
          <li>Past weeks open read-only with an <strong>Edit</strong> button, for days you forgot to mark.</li>
        </List>
      </Section>

      <Section id="tasks" title="3. Weekly tasks and carrying over">
        <List>
          <li>Tasks are open (☐), done (☑) or failed (✗). A task becomes ✗ when the week it’s shown in is over and it isn’t done.</li>
          <li><strong>Carry →</strong> on a ✗ task copies it into the current week. The two are linked (carriedFromId / carriedToId); the original stays ✗ in its own week.</li>
          <li>Quick add’s “Weekly task” always adds to the current week.</li>
          <li><strong>Drag to reorder</strong>: hold a task’s ≡ handle and move it. The new order shows at once; it’s written to the phone’s database (and synced) about a second after you stop, as one save, or straight away when the app goes to the background or you sign out (<C>queueTaskOrder</C> in <C>data/repo.js</C>). Only tasks whose position changed are saved (<C>applyOrder</C>, <C>dragTarget</C> in <C>lib/dragOrder.js</C>). Screen readers get “Move up / Move down” on the handle. Carried-in tasks start at the top until moved.</li>
          <li>The card shows “3 of 5 done” with a progress bar; done tasks have a green edge, ✗ tasks a red one.</li>
        </List>
      </Section>

      <Section id="motivation" title="4. This week’s motivation">
        <P>
          One line, added from quick add (+ → Weekly motivation). The card appears on the page only once a motivation exists;
          tap it to edit. It’s saved for the week you write it in; weeks without their own show the most recent earlier one, so it
          carries forward without storing copies.
        </P>
      </Section>

      <Section id="week-start" title="5. Changing the week start day">
        <P>
          Tasks and motivations are stored against their week’s first day, and a week owns every record dated inside it. Switching
          from Monday to Sunday weeks therefore loses nothing: a Monday-dated task simply shows in the Sunday week that contains
          that Monday, and turns ✗ at the end of that week.
        </P>
      </Section>

      <Section id="scores" title="6. Scores, streaks and the dashboard">
        <Table
          head={["Number", "How it’s counted"]}
          rows={[
            ["Habit score (5/7)", "Done days out of the days the habit existed that week"],
            ["Week total", "All habits’ done days out of the days so far (future days don’t count)"],
            ["Current streak 🔥", "Done days in a row up to today; if today isn’t marked yet it counts up to yesterday"],
            ["Best / longest streak", "The longest run of done days ever"],
            ["This week vs last", "Change in the share of habit-days done, in percentage points (up, down or same)"],
            ["Perfect days 🏆", "Days in the last 4 weeks (up to yesterday) when every habit that existed was done"],
            ["Strongest day", "The weekday with the highest share of habits done over the last 4 weeks"],
            ["Most consistent / needs attention", "Highest and lowest share over the last 28 days; a habit needs at least 3 days to count, and “needs attention” only shows below 60%"],
            ["Task rate", "Weekly tasks finished out of planned over the last 8 weeks"],
            ["Charts", "Last 12 weeks: share of habit-days done; tasks planned vs finished"],
          ]}
        />
        <Note>Everything on the Week page and dashboard is calculated on the phone, so it works offline.</Note>
      </Section>
    </>
  );
}
