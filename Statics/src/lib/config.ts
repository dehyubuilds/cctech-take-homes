import { PUBLIC_SITE_ORIGIN } from "./public-site-url";
import {
  PC_MAX_FULL_VIDEO_BYTES,
  PC_MAX_LISTING_IMAGE_BYTES,
  PC_MAX_THUMBNAIL_BYTES,
} from "./private-collection/upload-limits";

/**
 * Intentionally hardcoded — no `process.env` for AWS, Cognito, Twilio, Stripe, etc.
 * Edit this file to change deploy targets. Do not expect Netlify/UI env vars to
 * override Stripe here: production uses the keys below after you deploy this file.
 * Optional env vars exist only for a few routes (cron secrets, Dropflow API key, etc.).
 */
export const config = {
  aws: {
    accessKeyId: "AKIASCPOEM7JYLK5BJFR",
    secretAccessKey: "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",
    region: "us-east-1",
  },
  app: {
    name: "Statics",
    /** User-facing site (share links, Stripe return URLs, SMS, metadata). */
    baseUrl: PUBLIC_SITE_ORIGIN,
  },
  cognito: {
    region: "us-east-1",
    userPoolId: "us-east-1_slQDFliti",
    userPoolWebClientId: "4pp9aeol19sug0i4rk8fvddcq1",
    useReal: true,
  },
  twilio: {
    accountSid: "AC51aa42874175a8f9a1f7b95f3a3a5fe6",
    authToken: "b7fcdf5c6b0a09f106f977b58ffaadc5",
    phoneNumber: "+12407529966",
    verifyServiceId: "VA4d6b7b83646a2ae33cd23aeacab37041",
    useReal: true,
  },
  dynamo: {
    region: "us-east-1",
    tables: {
      users: "statics_users",
      apps: "statics_apps",
      subscriptions: "statics_subscriptions",
      subscriptionStop: "statics_subscription_stop",
      verify: "statics_verify",
      dropflow_users: "dropflow_users",
      dropflow_beats: "dropflow_beats",
      dropflow_orders: "dropflow_orders",
      dropflow_events: "dropflow_events",
      /** Buyer-saved free beats + dismissed purchases (My Tracks UI). */
      dropflow_user_saved_beats: "dropflow_user_saved_beats",
      dropflow_user_dismissed_orders: "dropflow_user_dismissed_orders",
      private_collection_videos: "private_collection_videos",
      private_collection_orders: "private_collection_orders",
      /** Buyer-saved free listings (My library). PK userId, SK videoId. */
      private_collection_user_saved_videos: "private_collection_user_saved_videos",
      /** Buyer hid a purchase from My collection (order remains valid). PK userId, SK orderId. */
      private_collection_user_dismissed_orders: "private_collection_user_dismissed_orders",
      /** SMS subscribers per creator (@username → follower userIds). */
      private_collection_creator_followers: "private_collection_creator_followers",
      /**
       * Creators who turned off browse + follows + SMS signals. PK creatorUsername only.
       * Absence from this table = searchable / discoverable (default).
       */
      private_collection_creator_discoverability_opt_out:
        "private_collection_creator_discoverability_opt_out",
      /** Curated sets: shared passcode, ordered listing IDs, optional original download policy. */
      private_collection_curated_collections: "private_collection_curated_collections",
      /** SMS subscribers per public curated collection (PK collectionId, SK followerUserId). */
      private_collection_collection_followers: "private_collection_collection_followers",
      /** Train Signal (legacy table names; do not rename in AWS without migration) */
      signal_instructors: "signal_instructors",
      signal_workouts: "signal_workouts",
      signal_follows: "signal_follows",
      train_signal_orders: "train_signal_orders",
      /** The Vibe — persisted LangGraph trip outputs per user */
      vibe_trips: "statics_vibe_trips",
      /** The Vibe — subscriber home location + signal prefs (PK userId) */
      vibe_signal_settings: "statics_vibe_signal_settings",
      /** The Vibe — idempotent daily SMS (PK userId, SK sentDateUtc YYYY-MM-DD) */
      vibe_daily_sms_log: "statics_vibe_daily_sms_log",
      /** The Vibe — hourly pulse baseline + update count (PK userId) */
      vibe_pulse_state: "statics_vibe_pulse_state",
      /** Signal Cut — creators, videos, profiles, signals, global trends (single-table layout) */
      signal_cut: "statics_signal_cut",
      /** ScoutSignal — per-user location runs + feedback (single-table: pk USER#id, sk RUN#… / FEEDBACK#…) */
      scout_signal: "statics_scout_signal",
      /** CFO Flow Pilot — industry prefs (USER#…), shared signals (INDUSTRY#…), optional delivery log */
      cfo_flow_pilot: "statics_cfo_flow_pilot",
      /** Remind Me — PK userId, SK reminderId (todo + scheduled SMS) */
      remind_me_reminders: "statics_remind_me_reminders",
      /** FXAlpha — PK pairTf (e.g. EURUSD_4h), SK createdAt#signalId */
      fxalpha_signals: "statics_fxalpha_signals",
      /** FXAlpha — per-user SMS watchlist (PK userId) */
      fxalpha_signal_settings: "statics_fxalpha_signal_settings",
      /** DemandGap — PK USER#id, SK WATCHLIST#signalId */
      demand_gap: "statics_demand_gap",
      /** GrowSignals — USER#…/GARDEN#…, GARDEN#…/PLANT#, WEATHER#, SIGNAL# */
      grow_signals: "statics_grow_signals",
      /** Operator OS — ROLE#…, CATALOG#ROLES, USER#… unlocks & progress */
      operator_os: "statics_operator_os",
      /** Art of the Question — INTERVIEW#…, CATALOG, USER#… saves */
      aotq: "statics_aotq",
      /** Short URLs for share tracking — PK shortId; destination + metadata + clickCount */
      short_links: "statics_short_links",
      /** Click events — PK shortId, SK eventKey (ISO#uuid) */
      short_link_events: "statics_short_link_events",
      /** YouTube import — PK userId, SK dayUtc (YYYY-MM-DD UTC); importCount starts per day */
      youtube_import_daily: "statics_youtube_import_daily",
      /** PK jobId — YouTube Data API snippet until import completes (TTL expiresAt). */
      youtube_import_job_meta: "statics_youtube_import_job_meta",
      /** PK youtubeVideoId — published Dropflow beatId (dedupe YouTube imports). */
      dropflow_youtube_beat_index: "statics_dropflow_youtube_beat_index",
    },
    useReal: true,
  },
  /** Train Signal — recurring membership + future workout video storage */
  /** The Vibe — subscription signals: weather → wear, timing, changing conditions; trial + recurring */
  theVibe: {
    stripeSubscriptionPriceId: "",
    trialPeriodDays: 7,
  },
  trainSignal: {
    stripeSubscriptionPriceId: "",
    trialPeriodDays: 7,
    bucket: "",
    baseUrl: "",
    /** One-time paid drops: platform fee like Private Collection */
    contentPlatformFeePercent: 0.05,
    minPaidDropPriceCents: 100,
    contentAccessDays: 365,
    /** Same bucket as Dropflow/PC; prefix train-signal/ */
    contentBucket: "statics-dropflow-142770202579",
    contentBaseUrl: "https://df31ebpsie5st.cloudfront.net",
  },
  dropflow: {
    platformFeePercent: 0.05,
    minPriceCents: 100,
    previewDurationSeconds: 15,
    bucket: "statics-dropflow-142770202579",
    /** CloudFront → S3 statics-dropflow (tracks, thumbnails, previews, private-collection, train-signal). */
    baseUrl: "https://df31ebpsie5st.cloudfront.net",
    /** Lambda that generates 15s preview; leave empty to skip. When set, beats POST invokes it after create. */
    previewLambdaName: "dropflow-generate-preview",
    /**
     * GSI on `dropflow_orders`: HASH buyerUserId, RANGE createdAt.
     * Add to existing tables: `scripts/add-dropflow-orders-buyer-gsi.sh`
     */
    ordersBuyerByDateGsi: "buyer-by-date",
  },
  /**
   * YouTube → S3 import (Dropflow track + Private Collection video).
   * **Dropflow (audio):** API Gateway WebSocket + `run_worker.py` on your machine (`localWebSocketMode` + table + URL).
   * **Private Collection (full video):** optional container **`lambdaName`** only (local bridge is audio-only).
   */
  youtubeImport: {
    /** Container Lambda — used for `pc_video` when set; Dropflow uses WebSocket + `run_worker.py` instead. */
    lambdaName: "",
    /** Reserved — Dropflow YouTube import no longer uses HTTP `POST /youtube-import` on EC2. */
    workerApiBaseUrl: "",
    workerApiSharedSecret: "",
    /**
     * Local WebSocket + home `run_worker.py` (see `scripts/local-youtube-import-worker/`). Required for
     * Dropflow `dropflow_track` imports.
     */
    localWebSocketMode: true,
    /** SAM stack `local-youtube-import-ws` output **JobsTableName** (PK `jobId`). */
    localWsJobsTable: "local-youtube-import-ws-JobsTable-171HZRV7TTC6M",
    /** SAM output **WebSocketURL** — browser opens this `wss://` after POST (returned in JSON). */
    localWebSocketUrl: "wss://n87m5zq2n5.execute-api.us-east-1.amazonaws.com/prod",
  },
  /**
   * Art of the Question — video projects. AWS calls use `config.aws` + regions here (not Netlify env keys).
   * S3 bucket: full transcripts under `aotq/…`. EC2: optional GPU worker behind Elastic IP; UI can start/stop.
   */
  artOfTheQuestion: {
    /** Transcript JSON in S3 (`aotq/{userId}/{projectId}/{sourceId}/transcript.json`). Empty = Dynamo inline only. */
    mediaBucket: "statics-dropflow-142770202579",
    /** Optional Lambda async ingest (name only). Empty = ingest in API route or EC2 worker per `transcriptBackend`. */
    mediaIngestFunctionName: "",
    /** EC2 instance to start/stop from the app (test worker — see `scripts/aotq-ec2-worker/deploy/EC2-PROVISIONED.md`). */
    workerInstanceId: "i-06758b196b999e766",
    workerInstanceRegion: "us-east-1",
    /**
     * Worker HTTP origin (Elastic IP). HTTP is OK for server-to-server from Netlify/Next API.
     * Add HTTPS + DNS later for stricter setups. Run `deploy/sync-worker-to-ec2.sh` once to install the app on the box.
     */
    workerApiBaseUrl: "http://13.219.48.172:8787",
    /** Same value as `AOTQ_WORKER_BEARER_TOKEN` on the EC2 worker `.env`. */
    workerApiSharedSecret: "1a9133617bf81f5a86138304492f23e0c33c5f103ac8a033",
    /**
     * `youtube_captions` — captions in the Next.js server (default).
     * `ec2_whisper` — POST job to `workerApiBaseUrl` when set; worker updates Dynamo when done.
     * **Local WebSocket bridge:** with `ec2_whisper` and `youtubeImport.localWebSocketMode` + table + `wss` URL, AoTQ
     * ingest uses the same bridge as Dropflow by default (see `useAotqLocalWebSocket`). Set `aotqLocalWebSocketMode: false`
     * to force direct `POST` to `workerApiBaseUrl` from the server instead. Env: `AOTQ_LOCAL_WEBSOCKET_MODE=0|1`.
     * **Local dev:** override via `.env.local` — `AOTQ_TRANSCRIPT_BACKEND`, `AOTQ_WORKER_API_BASE_URL`,
     * `AOTQ_WORKER_API_SECRET` (omit on Netlify; production uses this file only).
     */
    transcriptBackend: "ec2_whisper" as "youtube_captions" | "ec2_whisper",
    /** When true, worker contract may run an LLM pass after Whisper (worker implements). */
    runLlmAfterTranscribe: false,
    /**
     * WebSocket bridge for AoTQ ingest (same SAM stack as Dropflow). `true` / `false` = explicit; `undefined` would
     * auto-enable when the YouTube WS bridge is configured — we set `true` here to match `localWebSocketMode`.
     * Set `false` if this deployment must only use direct `workerApiBaseUrl` POST from the server.
     */
    aotqLocalWebSocketMode: true,
  },
  /**
   * YouTube Data API v3 — channel resolve + latest videos (Signal Cut, Private Collection bulk import).
   * Server-only. Set here **or** `YOUTUBE_DATA_API_KEY` env; config wins if non-empty.
   * Rotate any key that was pasted into chat or committed by mistake.
   */
  youtubeDataApiKey: "AIzaSyCfb7ZPEWexziAnmGRpeSD3wzibRuDMplM",
  /**
   * Signal Cut — trend sources. Same resolution pattern as `youtubeDataApiKey`:
   * set here first, optional override via `SIGNAL_CUT_REDDIT_SUBREDDITS` env (Netlify not required).
   */
  signalCut: {
    /** Comma-separated subreddit names for Reddit hot JSON (audience-language proxy). */
    redditSubreddits:
      "AmItheAsshole,relationships,AskReddit,storytellingvideos",
  },
  /**
   * CFO Flow Pilot — no secrets here. Macro series use **FXAlpha FRED** settings (`fxalpha.fredApiKey`,
   * `fredEnabled`). Executive copy uses **`openai.apiKey`** (same as Signal Cut / The Vibe). Optional SMS
   * digests use **`twilio`** when `smsDigestEnabled` is true.
   */
  cfoFlowPilot: {
    /** After `/api/cfo/run-daily-signals` refreshes industry signals, send SMS to opted-in users with verified phones. */
    smsDigestEnabled: true,
  },
  /**
   * Google Maps Platform — Geocoding + Places (ScoutSignal, The Vibe address search, etc.).
   * This is the default key for all server-side Maps calls (see `getScoutSignalGoogleMapsApiKey`).
   * To override from the host only, clear this string and set `GOOGLE_MAPS_API_KEY` in Netlify.
   */
  googleMapsApiKey: "AIzaSyAf8uGD4GtU6e8JwD0vMR_Zj5NxGAHva2c",
  /** Video PPV; objects under private-collection/ in the shared media bucket. */
  privateCollection: {
    platformFeePercent: 0.05,
    minPriceCents: 100,
    /** Access link validity for purchased full video (days). */
    downloadExpiryDays: 365,
    bucket: "statics-dropflow-142770202579",
    baseUrl: "https://df31ebpsie5st.cloudfront.net",
    /**
     * Same Lambda as Dropflow (`dropflow-generate-preview`): routes on `event.mode` for PC video/image jobs.
     */
    previewLambdaName: "dropflow-generate-preview",
    /** Target length for auto preview MP4 (clamped to source length; never below minPreviewClipSeconds when source allows). */
    previewDurationSeconds: 15,
    /** Auto preview clip is at least this many seconds when the source is long enough (Lambda + API). */
    minPreviewClipSeconds: 6,
    /** Aliases for upload API — canonical values in `upload-limits.ts`. */
    maxFullVideoUploadBytes: PC_MAX_FULL_VIDEO_BYTES,
    maxListingImageUploadBytes: PC_MAX_LISTING_IMAGE_BYTES,
    maxThumbnailUploadBytes: PC_MAX_THUMBNAIL_BYTES,
  },
  stripe: {
    // Test keys (safe for GitHub). For live checkout, set keys via a private deploy path — do not commit sk_live here.
    secretKey: "sk_test_51OXsV0HCxgj7mB8yEfuPrnyAZMRhoC9MQgr8bSp8g9yNvQ13Coro68YDfIqKIDCUYg2Wnp17xrvEU6E5UPcgcrz500Er5Mpfz0",
    webhookSecret: "whsec_CnYa17Pkp1zrLI7o1Ou9CXdISYwOfkF0", // Statics destination for /api/dropflow/webhook
    useReal: true,
  },
  /**
   * EventBridge → `statics-cron-invoker` Lambda → POST `/api/.../cron/*` with header `x-cron-secret`.
   * Hardcoded like Stripe/Twilio — not read from Netlify env. Must match
   * `scripts/lambda/statics-cron-invoker/index.mjs` and `deploy-statics-cron-invoker.sh`.
   */
  schedulerCronSecret:
    "f42f8c900908a0f956ce215350e972ce9a99fc4c96595ef99287b5794278c61a",
  /**
   * Remind Me — EventBridge **Scheduler** one-shot `at(…)` per reminder (see `remind-schedule.ts`).
   * Run `scripts/setup-remind-me-scheduler-iam.sh` then set ARNs. Disabled until `enabled` + both ARNs.
   */
  remindMeOneShotSchedule: {
    enabled: true,
    /** Role Scheduler assumes to invoke Lambda (trust `scheduler.amazonaws.com`). */
    schedulerTargetRoleArn:
      "arn:aws:iam::142770202579:role/EventBridgeSchedulerRemindInvokeCron",
    /** Must match `statics-cron-invoker` in the same account/region. */
    cronInvokerLambdaArn:
      "arn:aws:lambda:us-east-1:142770202579:function:statics-cron-invoker",
  },
  /**
   * OpenAI — **hardcoded only** (no Netlify/UI `OPENAI_*` env). All server LLM paths use
   * `resolveOpenAiApiKey()` → `openai.apiKey` and optional `organization` / `project` below.
   */
  openai: {
    /**
     * **Statics** API key from https://platform.openai.com/api-keys (named “Statics” — Reveal, copy full secret).
     * Paste between the quotes, run `node scripts/verify-openai-config-key.mjs`, then `./Statics/scripts/deploy-to-github-repos.sh`.
     * Leave empty only until pasted; do not commit a key that was ever exposed publicly without rotating it in OpenAI first.
     */
    apiKey: "",
    /** Optional — Organization ID (e.g. `org-…`) when OpenAI requires it for this key. */
    organization: "",
    /** Optional — Project ID from the dashboard when OpenAI requires it for this key. */
    project: "",
  },
  /**
   * FXAlpha — forex data + optional SMS flags. Hardcoded like OpenAI/Twilio (not Netlify env).
   * - Empty `alphaVantageKey` + `twelveDataKey` → scans fail until at least one key is set (no synthetic OHLC).
   * - `mockData` only affects FRED macro stub text when you want to avoid FRED HTTP locally.
   * - SMS uses existing `twilio` config when `smsEnabled` is true.
   */
  fxalpha: {
    /** https://www.alphavantage.co/support/#api-key */
    alphaVantageKey: "1QVTH3GSB88ED9SD",
    /** https://twelvedata.com/ — fallback when AV rate-limits or returns no series */
    twelveDataKey: "1c40ef2587884144a2a9864890c7cee5",
    /** Optional macro context (FRED); core V1 detection does not require it */
    fredApiKey: "645c26f61dca4d604801d5e7bbd8c656",
    /** Synthetic OHLC for dev / when both market keys are empty */
    mockData: false,
    /** When true, cron/user refresh may send BUY/SELL SMS per `sms-cooldown` + confidence rules */
    smsEnabled: false,
    /** FRED macro backdrop (free API). When false, no FRED HTTP. */
    fredEnabled: true,
    /**
     * Max FRED series pulled per snapshot (1 HTTP request per series, latest observation only).
     * Keep ≤3 to stay courteous on the free key; full cron job still uses only ONE snapshot for all pairs.
     */
    fredMaxSeriesPerSnapshot: 3,
    /** Reuse FRED snapshot for user refresh this many ms (reduces duplicate calls). */
    fredMacroCacheTtlMs: 300_000,
  },
  resend: {
    apiKey: "re_18vf87Rt_E6ZWWi7e7AJPEV18KSDvdKE1",
    from: "Dropflow <receipts@statics-ai.com>",
  },
  avatar: {
    bucket: "statics-avatars-142770202579",
    baseUrl: "https://statics-avatars-142770202579.s3.us-east-1.amazonaws.com",
    useReal: true,
  },
  admin: {
    adminEmail: "dehyu.sinyan@gmail.com",
  },
  /**
   * DemandGap — cross-border signals. Google Trends + Reddit use public endpoints (no key).
   * eBay sold comps need a Finding API App ID (developer.ebay.com). Override with `EBAY_APP_ID` env.
   */
  demandGap: {
    ebayAppId: "",
  },
} as const;
