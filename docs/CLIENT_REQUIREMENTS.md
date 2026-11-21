# FIELD Machine client requirements

TeamViewer is blocked. FIELD Machine needs its own remote support workflow.

## Project status and next checkpoint

- Windows setup is complete per the project owner.
- The Files workflow is in progress in the pipeline. Once it is ready, test it
  end to end against the client requirements below before moving on. Record the
  results and any gaps or blocked checks in the project test documentation.

## One-time tablet setup

1. Red Edge installs the FIELD Machine app on the cab tablet. The app displays
   a six-digit pairing code.
2. In the portal, Red Edge registers the tablet serial number and pairing code
   and assigns the customer, machine, and site.
3. The tablet receives its own secure login. A lost tablet can be disabled in
   one click.

## Sending design files and Files acceptance checks

1. A surveyor drags a design folder containing DXF, LandXML, localisation, and
   configuration files into the portal.
2. The surveyor can target one machine, several machines, or an entire site.
   Verify delivery reaches the selected targets for each option.
3. Before sending, the portal shows what each machine will receive and which
   files will be replaced.
4. The tablet downloads in the background. Interrupt 4G mid-transfer and verify
   it resumes from the saved progress. Verify SHA-256 before installation and
   confirm a corrupt or incomplete file is never installed.
5. Verify delivered files appear in the app's Files folder grouped by project.
6. Verify the portal reports each machine as Waiting, Downloading, Arrived, or
   Failed as appropriate, including a failed delivery and retry.
7. Verify older versions remain available and an individual machine can be
   rolled back. Check that the portal still retains every sent version after
   delivery and shows which design version was on each machine and when.

## Remote support

- A supervisor or Red Edge support starts a session by selecting Connect on a
  machine in the portal. The tablet prompts the operator to Allow or Decline.
- After Allow, support sees the tablet screen live in the browser and can tap,
  type, and scroll, for example to move files into machine control software or
  fix a setting. Either side can end the session. Every session is logged.
- The operator can also tap Request help on the tablet. Support is notified
  and can join without a second Allow prompt. The operator initiates consent
  through that request.

## Files back to the office

- The operator can send as-built and exported files from the tablet. The files
  can also be sent on a schedule. Test both triggers when this workflow is ready.
- Returned files, including as-builts, exports, logs, and configuration backups,
  are stored in the portal under the corresponding machine and site. Verify
  that returned files are associated with the correct machine and site.

## Recordings, history, and portal retention

- Every remote session and screen share is recorded automatically. The tablet
  shows a Recording indicator during recording.
- When the session ends, the recording is saved to the cloud and transcribed.
  The machine's History tab lists it as a Remote session entry with who
  connected, the date, duration, video recording, and transcript.
- Supervisors and Red Edge can replay recordings or search transcripts for
  training or to review what changed on the machine.
- The portal Files library retains every file sent to a machine and all its
  versions after delivery. Returned files remain under the machine and site.
  Session recordings and transcripts stay with the machine's history.
