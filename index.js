require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  Events,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  MessageFlags
} = require("discord.js");

const config = require("./config");

// =====================
// CLIENT
// =====================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// =====================
// DATA
// =====================

const DATA_DIR =
  process.env.DATA_DIR ||
  "/app/data";

fs.mkdirSync(
  DATA_DIR,
  {
    recursive: true
  }
);

const TICKET_FILE =
  path.join(
    DATA_DIR,
    "tickets.json"
  );

const XP_FILE =
  path.join(
    DATA_DIR,
    "xp.json"
  );

function loadJson(
  file,
  fallback
) {
  try {
    if (!fs.existsSync(file)) {
      return fallback;
    }

    return JSON.parse(
      fs.readFileSync(
        file,
        "utf8"
      )
    );
  } catch (error) {
    console.error(
      `❌ Failed loading ${file}:`,
      error
    );

    return fallback;
  }
}

function saveJson(
  file,
  data
) {
  const temp =
    `${file}.tmp`;

  fs.writeFileSync(
    temp,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf8"
  );

  fs.renameSync(
    temp,
    file
  );
}

const ticketData =
  loadJson(
    TICKET_FILE,
    {
      tickets: {}
    }
  );

const xpData =
  loadJson(
    XP_FILE,
    {
      guilds: {}
    }
  );

function saveTickets() {
  saveJson(
    TICKET_FILE,
    ticketData
  );
}

function brand() {
  return (
    config.botName ||
    "Community Bot"
  );
}

// =====================
// ACCESS
// =====================

function isStaff(
  member,
  guild
) {
  if (!member || !guild) {
    return false;
  }

  return Boolean(
    member.id === guild.ownerId ||
    member.permissions.has(
      PermissionFlagsBits.Administrator
    ) ||
    (
      config.staffRoleId &&
      member.roles.cache.has(
        config.staffRoleId
      )
    ) ||
    (
      config.managementRoleId &&
      member.roles.cache.has(
        config.managementRoleId
      )
    )
  );
}

function isManagement(
  member,
  guild
) {
  if (!member || !guild) {
    return false;
  }

  return Boolean(
    member.id === guild.ownerId ||
    member.permissions.has(
      PermissionFlagsBits.Administrator
    ) ||
    (
      config.managementRoleId &&
      member.roles.cache.has(
        config.managementRoleId
      )
    )
  );
}

// =====================
// GENERAL
// =====================

function safeChannelName(
  value
) {
  return String(
    value || "user"
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9א-ת_-]/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    )
    .slice(
      0,
      24
    );
}

function parseDuration(
  value
) {
  const values = {
    "10m":
      10 * 60 * 1000,
    "30m":
      30 * 60 * 1000,
    "1h":
      60 * 60 * 1000,
    "6h":
      6 * 60 * 60 * 1000,
    "12h":
      12 * 60 * 60 * 1000,
    "1d":
      24 * 60 * 60 * 1000,
    "3d":
      3 * 24 * 60 * 60 * 1000,
    "7d":
      7 * 24 * 60 * 60 * 1000
  };

  return (
    values[value] ||
    null
  );
}

function formatDuration(
  ms
) {
  if (!ms) {
    return "לא ידוע";
  }

  const minutes =
    Math.round(
      ms / 60000
    );

  if (minutes < 60) {
    return `${minutes} דקות`;
  }

  const hours =
    Math.round(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours} שעות`;
  }

  return `${Math.round(
    hours / 24
  )} ימים`;
}

// =====================
// VERIFY
// =====================

function canEditOverwrites(
  channel
) {
  return Boolean(
    channel &&
    !channel.isThread?.() &&
    channel.permissionOverwrites &&
    typeof channel.permissionOverwrites.edit ===
      "function"
  );
}

function isTextChannelForWriting(
  channel
) {
  return [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildForum,
    ChannelType.GuildMedia
  ].includes(
    channel.type
  );
}

function verifyPanel() {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor("Green")
        .setTitle(
          `✅ ${brand()} • Verify`
        )
        .setDescription(
          [
            "ברוכים הבאים לשרת!",
            "",
            "לחצו על **Verify** כדי לקבל את רול ה־Member ולקבל גישה לחדרי הקהילה.",
            "",
            "לחיצה אחת — בלי מספרים ובלי שאלות."
          ].join("\n")
        )
        .setFooter({
          text:
            `${brand()} • Verification`
        })
        .setTimestamp()
    ],

    components: [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              "verify_member"
            )
            .setLabel("Verify")
            .setEmoji("✅")
            .setStyle(
              ButtonStyle.Success
            )
        )
    ]
  };
}

async function setupVerify(
  interaction
) {
  const guild =
    interaction.guild;

  const verifyChannel =
    interaction.channel;

  if (
    !guild ||
    !verifyChannel ||
    !verifyChannel.isTextBased()
  ) {
    throw new Error(
      "VERIFY_CHANNEL_INVALID"
    );
  }

  if (!config.memberRoleId) {
    throw new Error(
      "MEMBER_ROLE_MISSING"
    );
  }

  const memberRole =
    await guild.roles
      .fetch(
        config.memberRoleId
      )
      .catch(
        () => null
      );

  if (!memberRole) {
    throw new Error(
      "MEMBER_ROLE_NOT_FOUND"
    );
  }

  const botMember =
    await guild.members
      .fetchMe();

  if (
    !botMember.permissions.has(
      PermissionFlagsBits.ManageChannels
    )
  ) {
    throw new Error(
      "NO_MANAGE_CHANNELS"
    );
  }

  if (
    !botMember.permissions.has(
      PermissionFlagsBits.ManageRoles
    )
  ) {
    throw new Error(
      "NO_MANAGE_ROLES"
    );
  }

  if (
    memberRole.position >=
    botMember.roles.highest.position
  ) {
    throw new Error(
      "BOT_ROLE_TOO_LOW"
    );
  }

  const everyoneRole =
    guild.roles.everyone;

  const writableIds =
    new Set(
      Array.isArray(
        config.verifyWritableChannelIds
      )
        ? config.verifyWritableChannelIds
        : []
    );

  const channels =
    await guild.channels.fetch();

  // Snapshot before permissions are changed.
  // Public rooms are managed automatically.
  // Explicit writable IDs are always managed, even if currently hidden.
  const managedChannels =
    [...channels.values()]
      .filter(
        channel => {
          if (
            !canEditOverwrites(
              channel
            ) ||
            channel.id ===
              verifyChannel.id
          ) {
            return false;
          }

          const publicBefore =
            Boolean(
              channel
                .permissionsFor(
                  everyoneRole
                )
                ?.has(
                  PermissionFlagsBits.ViewChannel
                )
            );

          return (
            publicBefore ||
            writableIds.has(
              channel.id
            )
          );
        }
      )
      .sort(
        (a, b) => {
          const aCategory =
            a.type ===
            ChannelType.GuildCategory
              ? 0
              : 1;

          const bCategory =
            b.type ===
            ChannelType.GuildCategory
              ? 0
              : 1;

          return (
            aCategory -
            bCategory
          );
        }
      );

  let managed = 0;
  let writable = 0;
  let readOnly = 0;
  let failed = 0;

  for (
    const channel
    of managedChannels
  ) {
    try {
      await channel
        .permissionOverwrites
        .edit(
          everyoneRole,
          {
            ViewChannel: false
          },
          {
            reason:
              `${brand()} Verify setup`
          }
        );

      if (
        channel.type ===
        ChannelType.GuildCategory
      ) {
        await channel
          .permissionOverwrites
          .edit(
            memberRole,
            {
              ViewChannel: true
            },
            {
              reason:
                `${brand()} Member category`
            }
          );

        managed += 1;
        continue;
      }

      if (
        isTextChannelForWriting(
          channel
        )
      ) {
        const canWrite =
          writableIds.has(
            channel.id
          );

        await channel
          .permissionOverwrites
          .edit(
            memberRole,
            canWrite
              ? {
                  ViewChannel: true,
                  SendMessages: true,
                  AddReactions: true,
                  SendMessagesInThreads: true,
                  CreatePublicThreads: true
                }
              : {
                  ViewChannel: true,
                  SendMessages: false,
                  AddReactions: false,
                  SendMessagesInThreads: false,
                  CreatePublicThreads: false,
                  CreatePrivateThreads: false
                },
            {
              reason:
                canWrite
                  ? `${brand()} writable Member room`
                  : `${brand()} read-only Member room`
            }
          );

        if (canWrite) {
          writable += 1;
        } else {
          readOnly += 1;
        }
      } else {
        await channel
          .permissionOverwrites
          .edit(
            memberRole,
            {
              ViewChannel: true
            },
            {
              reason:
                `${brand()} Member room`
            }
          );
      }

      managed += 1;
    } catch (error) {
      failed += 1;

      console.error(
        `❌ Verify setup failed for ${channel.id}:`,
        error
      );
    }
  }

  // Do this last so the Verify room stays public
  // even if its category was just locked.
  await verifyChannel
    .permissionOverwrites
    .edit(
      everyoneRole,
      {
        ViewChannel: true,
        SendMessages: false,
        AddReactions: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        SendMessagesInThreads: false
      },
      {
        reason:
          `${brand()} public Verify room`
      }
    );

  await verifyChannel
    .permissionOverwrites
    .edit(
      memberRole,
      {
        ViewChannel: true,
        SendMessages: false
      },
      {
        reason:
          `${brand()} Verify room`
      }
    );

  return {
    memberRole,
    verifyChannel,
    managed,
    writable,
    readOnly,
    failed
  };
}

// =====================
// TICKETS
// =====================

const ticketTypes = {
  staff_help: {
    emoji: "🆘",
    name:
      "עזרה מצוות",
    description:
      "עזרה מהצוות בנושאים שדורשים טיפול ותמיכה."
  },

  buy_user: {
    emoji: "💵",
    name:
      "רכישת משתמש",
    description:
      "פנייה בנושא רכישת משתמש דרך השרת."
  },

  partnership: {
    emoji: "🤝",
    name:
      "הצעת שיתוף פעולה",
    description:
      "הצעה לשיתוף פעולה בין השרת שלכם לשרת שלנו."
  }
};

function ticketPanel() {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor("Blue")
        .setTitle(
          `🎫 ${brand()} • מרכז פניות`
        )
        .setDescription(
          [
            "בחרו את סוג הפנייה המתאים:",
            "",
            "🆘 **עזרה מצוות**",
            "עזרה מהצוות בנושאים שדורשים טיפול.",
            "",
            "💵 **רכישת משתמש**",
            "פנייה בנושא רכישת משתמש דרך השרת.",
            "",
            "🤝 **הצעת שיתוף פעולה**",
            "הצעה לשיתוף פעולה בין השרתים."
          ].join("\n")
        )
        .setFooter({
          text:
            `${brand()} • Support Center`
        })
        .setTimestamp()
    ],

    components: [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              "ticket_open:staff_help"
            )
            .setLabel(
              "עזרה מצוות"
            )
            .setEmoji("🆘")
            .setStyle(
              ButtonStyle.Primary
            ),

          new ButtonBuilder()
            .setCustomId(
              "ticket_open:buy_user"
            )
            .setLabel(
              "רכישת משתמש"
            )
            .setEmoji("💵")
            .setStyle(
              ButtonStyle.Success
            ),

          new ButtonBuilder()
            .setCustomId(
              "ticket_open:partnership"
            )
            .setLabel(
              "הצעת שיתוף פעולה"
            )
            .setEmoji("🤝")
            .setStyle(
              ButtonStyle.Primary
            )
        )
    ]
  };
}

function parseTicketTopic(
  channel
) {
  const result = {};

  for (
    const part
    of String(
      channel?.topic || ""
    ).split(";")
  ) {
    const [
      key,
      ...rest
    ] =
      part.split("=");

    if (
      key &&
      rest.length
    ) {
      result[key.trim()] =
        rest.join("=")
          .trim();
    }
  }

  return result;
}

function ticketTopic({
  owner,
  type,
  claimed = ""
}) {
  return [
    "communityTicket=1",
    `owner=${owner}`,
    `type=${type}`,
    `claimed=${claimed}`
  ].join(";");
}

function ticketControls(
  claimed = ""
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            claimed
              ? "ticket_release"
              : "ticket_claim"
          )
          .setLabel(
            claimed
              ? "Release"
              : "Claim"
          )
          .setEmoji(
            claimed
              ? "🔓"
              : "🙋"
          )
          .setStyle(
            claimed
              ? ButtonStyle.Secondary
              : ButtonStyle.Success
          ),

        new ButtonBuilder()
          .setCustomId(
            "ticket_add_user"
          )
          .setLabel(
            "Add User"
          )
          .setEmoji("➕")
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            "ticket_remove_user"
          )
          .setLabel(
            "Remove User"
          )
          .setEmoji("➖")
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            "ticket_close"
          )
          .setLabel("Close")
          .setEmoji("🔒")
          .setStyle(
            ButtonStyle.Danger
          )
      )
  ];
}

function ticketStatusEmbed(
  messageEmbed,
  claimed = ""
) {
  const embed =
    EmbedBuilder.from(
      messageEmbed
    );

  const fields =
    Array.isArray(
      embed.data.fields
    )
      ? embed.data.fields.filter(
          field =>
            field.name !==
              "🛡️ מטפל בטיקט"
        )
      : [];

  if (claimed) {
    fields.push({
      name:
        "🛡️ מטפל בטיקט",
      value:
        `<@${claimed}>`,
      inline: false
    });
  }

  embed.setFields(
    fields
  );

  return embed;
}

async function openTicket(
  interaction,
  type
) {
  const info =
    ticketTypes[type];

  if (!info) {
    return interaction.reply({
      content:
        "❌ סוג הטיקט לא קיים.",
      flags:
        MessageFlags.Ephemeral
    });
  }

  const duplicate =
    interaction.guild.channels.cache.find(
      channel => {
        const data =
          parseTicketTopic(
            channel
          );

        return (
          data.communityTicket ===
            "1" &&
          data.owner ===
            interaction.user.id
        );
      }
    );

  if (duplicate) {
    return interaction.reply({
      content:
        `❌ כבר יש לך טיקט פתוח: ${duplicate}`,
      flags:
        MessageFlags.Ephemeral
    });
  }

  const category =
    interaction.guild.channels.cache.get(
      config.ticketCategoryId
    );

  if (
    !category ||
    category.type !==
      ChannelType.GuildCategory
  ) {
    return interaction.reply({
      content:
        "❌ `ticketCategoryId` לא מוגדר נכון.",
      flags:
        MessageFlags.Ephemeral
    });
  }

  const overwrites = [
    {
      id:
        interaction.guild.id,
      deny: [
        PermissionFlagsBits.ViewChannel
      ]
    },

    {
      id:
        interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  if (
    config.staffRoleId
  ) {
    overwrites.push({
      id:
        config.staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }

  if (
    config.managementRoleId &&
    config.managementRoleId !==
      config.staffRoleId
  ) {
    overwrites.push({
      id:
        config.managementRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }

  const channel =
    await interaction.guild.channels.create({
      name:
        `${info.emoji}-${safeChannelName(
          interaction.user.username
        )}`,
      type:
        ChannelType.GuildText,
      parent:
        category.id,
      topic:
        ticketTopic({
          owner:
            interaction.user.id,
          type
        }),
      permissionOverwrites:
        overwrites
    });

  ticketData.tickets[
    channel.id
  ] = {
    owner:
      interaction.user.id,
    type,
    openedAt:
      Date.now()
  };

  saveTickets();

  await channel.send({
    content:
      config.staffRoleId
        ? `<@&${config.staffRoleId}>`
        : undefined,

    embeds: [
      new EmbedBuilder()
        .setColor("Blue")
        .setTitle(
          `${info.emoji} ${info.name}`
        )
        .setDescription(
          [
            `שלום ${interaction.user}, הפנייה שלך נפתחה.`,
            "",
            `📌 **סוג:** ${info.name}`,
            `📝 ${info.description}`,
            "",
            "כתוב כאן את כל הפרטים והצוות יגיע אליך בהקדם."
          ].join("\n")
        )
        .setThumbnail(
          interaction.user
            .displayAvatarURL({
              size: 256
            })
        )
        .setFooter({
          text:
            `${brand()} • Ticket System`
        })
        .setTimestamp()
    ],

    components:
      ticketControls(),

    allowedMentions: {
      roles:
        config.staffRoleId
          ? [
              config.staffRoleId
            ]
          : []
    }
  });

  return interaction.reply({
    content:
      `✅ הטיקט נפתח: ${channel}`,
    flags:
      MessageFlags.Ephemeral
  });
}

async function createTranscript(
  channel
) {
  const messages = [];
  let before = null;

  while (true) {
    const batch =
      await channel.messages.fetch({
        limit: 100,
        before
      });

    if (!batch.size) {
      break;
    }

    messages.push(
      ...batch.values()
    );

    before =
      batch.last().id;

    if (
      batch.size < 100
    ) {
      break;
    }
  }

  messages.sort(
    (a, b) =>
      a.createdTimestamp -
      b.createdTimestamp
  );

  const lines = [
    `${brand()} Ticket Transcript`,
    `Channel: #${channel.name}`,
    `Channel ID: ${channel.id}`,
    ""
  ];

  for (
    const message
    of messages
  ) {
    lines.push(
      `[${message.createdAt.toLocaleString()}] ${message.author.tag}: ${message.content || "[No text]"}`
    );

    for (
      const attachment
      of message.attachments.values()
    ) {
      lines.push(
        `Attachment: ${attachment.url}`
      );
    }
  }

  return Buffer.from(
    lines.join("\n"),
    "utf8"
  );
}


// =====================
// XP + XP SHOP + CASINO
// Zone X style
// =====================

const casinoCooldowns = new Map();
const xpPurchaseLocks = new Set();

function getGuildXpData(guildId) {
  if (!xpData.guilds[guildId]) {
    xpData.guilds[guildId] = {
      users: {}
    };
  }

  return xpData.guilds[guildId];
}

function getXpProfile(guildId, userId) {
  const guildData =
    getGuildXpData(guildId);

  if (!guildData.users[userId]) {
    guildData.users[userId] = {
      xp: 0,
      messages: 0,
      lastXpAt: 0
    };
  }

  const profile =
    guildData.users[userId];

  profile.xp =
    Math.max(
      0,
      Number(profile.xp || 0)
    );

  profile.messages =
    Math.max(
      0,
      Number(profile.messages || 0)
    );

  profile.lastXpAt =
    Math.max(
      0,
      Number(profile.lastXpAt || 0)
    );

  return profile;
}

function saveXpData() {
  saveJson(
    XP_FILE,
    xpData
  );
}

function formatXp(amount) {
  return Number(
    amount || 0
  ).toLocaleString(
    "en-US"
  );
}

function parseXpAmount(value) {
  const amount =
    Number(
      String(
        value || ""
      ).replace(/,/g, "")
    );

  if (
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    return null;
  }

  return amount;
}

function getMaxCasinoBet() {
  const configured =
    Number(config.maxCasinoBet);

  if (
    Number.isInteger(configured) &&
    configured > 0
  ) {
    return configured;
  }

  return 1000;
}

function getCasinoCooldownMs() {
  const configured =
    Number(
      config.casinoCooldownMs
    );

  if (
    Number.isInteger(configured) &&
    configured >= 1000
  ) {
    return configured;
  }

  return 5000;
}

function checkCasinoCooldown(
  guildId,
  userId
) {
  const key =
    `${guildId}:${userId}`;

  const now =
    Date.now();

  const expiresAt =
    casinoCooldowns.get(key) ||
    0;

  if (expiresAt > now) {
    return expiresAt - now;
  }

  casinoCooldowns.set(
    key,
    now +
      getCasinoCooldownMs()
  );

  return 0;
}

function getShopItems() {
  return Array.isArray(
    config.xpShop
  )
    ? config.xpShop
        .filter(
          item =>
            item &&
            item.key &&
            item.name &&
            item.roleId &&
            !String(
              item.roleId
            ).startsWith(
              "PUT_"
            ) &&
            Number.isFinite(
              Number(item.price)
            ) &&
            Number(item.price) >
              0
        )
        .slice(0, 25)
    : [];
}

function findShopItem(key) {
  const normalized =
    String(
      key || ""
    )
      .trim()
      .toLowerCase();

  return getShopItems().find(
    item =>
      String(
        item.key
      ).toLowerCase() ===
      normalized
  );
}

function buildXpHelpEmbed() {
  return new EmbedBuilder()
    .setColor("Purple")
    .setTitle(
      `🎰 ${brand()} • Casino Center`
    )
    .setDescription(
      [
        "### 🎮 Slash Casino",
        "`/coinflip` — Heads / Tails",
        "`/dice` — נחש מספר 1–6",
        "`/slots` — מכונת מזל",
        "`/roulette` — Red / Black / Green",
        "`/highlow` — Higher / Lower",
        "`/rps` — Rock / Paper / Scissors",
        "`/number` — נחש מספר 1–10",
        "`/wheel` — גלגל מכפילים",
        "`/jackpot` — Lucky Roll גדול",
        "",
        "### ⚔️ Player vs Player",
        "`/challenge` — אתגר XP מול משתמש אחר עם Accept / Decline",
        "משחקי Challenge: Coinflip, Dice Duel, High Card",
        "",
        "### 💰 XP",
        "`/xp` — היתרה שלך",
        "`/leaderboard` — Top 10",
        "`!xp` / `!balance` / `!bal` עדיין עובדים",
        "",
        "### 🛒 XP Shop",
        "הנהלה שולחת את החנות עם `/setup-xp-shop`.",
        "",
        `**Max Bet:** ${formatXp(getMaxCasinoBet())} XP`,
        `**Cooldown:** ${Math.ceil(getCasinoCooldownMs() / 1000)} שניות`
      ].join("\n")
    )
    .setFooter({
      text:
        `${brand()} • Virtual XP only`
    })
    .setTimestamp();
}

function buildXpShopPanel() {
  const items =
    getShopItems();

  if (!items.length) {
    return null;
  }

  const embed =
    new EmbedBuilder()
      .setColor("Blue")
      .setTitle(
        `🛒 ${brand()} • XP Shop`
      )
      .setDescription(
        [
          "לחצו על הכפתור של הרול שאתם רוצים לקנות.",
          "ה־XP יורד רק אחרי שהבוט מצליח לתת את הרול.",
          "",
          ...items.map(
            item =>
              [
                `${item.emoji || "🎁"} **${item.name}**`,
                `💰 **${formatXp(item.price)} XP**`,
                `🎭 <@&${item.roleId}>`
              ].join("\n")
          )
        ].join("\n\n")
      )
      .setFooter({
        text:
          `${brand()} • XP Shop`
      })
      .setTimestamp();

  const rows = [];

  for (
    let i = 0;
    i < items.length;
    i += 5
  ) {
    const row =
      new ActionRowBuilder();

    for (
      const item
      of items.slice(
        i,
        i + 5
      )
    ) {
      const button =
        new ButtonBuilder()
          .setCustomId(
            `xp_shop_buy:${String(
              item.key
            ).slice(0, 80)}`
          )
          .setLabel(
            `${String(
              item.name
            ).slice(0, 45)} • ${formatXp(item.price)} XP`
          )
          .setStyle(
            ButtonStyle.Primary
          );

      if (item.emoji) {
        button.setEmoji(
          item.emoji
        );
      }

      row.addComponents(
        button
      );
    }

    rows.push(row);
  }

  return {
    embeds: [embed],
    components: rows,
    allowedMentions: {
      roles: []
    }
  };
}

async function buyXpRoleFromButton(
  interaction,
  itemKey
) {
  const lockKey =
    `${interaction.guild.id}:${interaction.user.id}`;

  if (
    xpPurchaseLocks.has(
      lockKey
    )
  ) {
    return interaction.reply({
      content:
        "⏳ יש לך כבר רכישה שמתבצעת.",
      flags:
        MessageFlags.Ephemeral
    });
  }

  xpPurchaseLocks.add(
    lockKey
  );

  try {
    await interaction.deferReply({
      flags:
        MessageFlags.Ephemeral
    });

    const item =
      findShopItem(itemKey);

    if (!item) {
      return interaction.editReply({
        content:
          "❌ הפריט לא קיים יותר בחנות. בקש מהצוות לשלוח פאנל חדש."
      });
    }

    const member =
      await interaction.guild.members
        .fetch(
          interaction.user.id
        )
        .catch(() => null);

    if (!member) {
      return interaction.editReply({
        content:
          "❌ לא מצאתי אותך בשרת."
      });
    }

    if (
      member.roles.cache.has(
        item.roleId
      )
    ) {
      return interaction.editReply({
        content:
          `❌ כבר יש לך את הרול **${item.name}**. לא ירד XP.`
      });
    }

    const role =
      await interaction.guild.roles
        .fetch(
          item.roleId
        )
        .catch(() => null);

    const botMember =
      await interaction.guild.members
        .fetchMe()
        .catch(() => null);

    if (!role) {
      return interaction.editReply({
        content:
          "❌ הרול לא נמצא. לא ירד XP."
      });
    }

    if (
      !botMember ||
      !botMember.permissions.has(
        PermissionFlagsBits.ManageRoles
      ) ||
      role.managed ||
      role.position >=
        botMember.roles.highest.position
    ) {
      return interaction.editReply({
        content:
          "❌ הבוט לא יכול לתת את הרול הזה. שים את רול הבוט מעל רולי החנות ותן `Manage Roles`. לא ירד XP."
      });
    }

    const profile =
      getXpProfile(
        interaction.guild.id,
        interaction.user.id
      );

    const price =
      Number(item.price);

    if (
      profile.xp < price
    ) {
      return interaction.editReply({
        content:
          [
            `❌ אין לך מספיק XP ל־**${item.name}**.`,
            `מחיר: **${formatXp(price)} XP**`,
            `יש לך: **${formatXp(profile.xp)} XP**`
          ].join("\n")
      });
    }

    try {
      await member.roles.add(
        role,
        `${brand()} XP Shop purchase`
      );
    } catch (error) {
      console.error(
        "❌ XP shop role add:",
        error
      );

      return interaction.editReply({
        content:
          "❌ לא הצלחתי לתת את הרול ולכן לא ירד XP."
      });
    }

    profile.xp -= price;
    saveXpData();

    return interaction.editReply({
      content:
        [
          `✅ קנית את **${item.name}** ב־**${formatXp(price)} XP**!`,
          `🎭 קיבלת את הרול ${role}.`,
          `💰 נשארו לך **${formatXp(profile.xp)} XP**.`
        ].join("\n")
    });
  } finally {
    xpPurchaseLocks.delete(
      lockKey
    );
  }
}

function awardMessageXp(message) {
  const profile =
    getXpProfile(
      message.guild.id,
      message.author.id
    );

  const now =
    Date.now();

  const cooldownMs =
    Math.max(
      10000,
      Number(
        config.xpMessageCooldownMs
      ) || 60000
    );

  if (
    now -
      profile.lastXpAt <
    cooldownMs
  ) {
    return 0;
  }

  const min =
    Math.max(
      1,
      Number(
        config.xpPerMessageMin
      ) || 5
    );

  const max =
    Math.max(
      min,
      Number(
        config.xpPerMessageMax
      ) || 15
    );

  const gained =
    Math.floor(
      Math.random() *
        (
          max -
          min +
          1
        )
    ) + min;

  profile.xp += gained;
  profile.messages += 1;
  profile.lastXpAt = now;

  saveXpData();

  return gained;
}

function validateBet(
  guildId,
  userId,
  rawAmount
) {
  const amount =
    parseXpAmount(
      rawAmount
    );

  if (!amount) {
    return {
      ok: false,
      message:
        "❌ סכום לא תקין."
    };
  }

  const profile =
    getXpProfile(
      guildId,
      userId
    );

  const maxBet =
    getMaxCasinoBet();

  if (
    amount > maxBet
  ) {
    return {
      ok: false,
      message:
        `❌ ההימור המקסימלי הוא **${formatXp(maxBet)} XP**.`
    };
  }

  if (
    profile.xp < amount
  ) {
    return {
      ok: false,
      message:
        `❌ אין לך מספיק XP. יש לך **${formatXp(profile.xp)} XP**.`
    };
  }

  return {
    ok: true,
    amount,
    profile
  };
}

async function playCoinflip(
  message,
  args
) {
  const cooldown =
    checkCasinoCooldown(
      message.guild.id,
      message.author.id
    );

  if (cooldown > 0) {
    return message.reply(
      `⏳ חכה עוד **${Math.ceil(
        cooldown / 1000
      )} שניות**.`
    );
  }

  const validation =
    validateBet(
      message.guild.id,
      message.author.id,
      args[0]
    );

  if (!validation.ok) {
    return message.reply(
      validation.message
    );
  }

  const aliases = {
    h: "heads",
    head: "heads",
    heads: "heads",
    "עץ": "heads",
    t: "tails",
    tail: "tails",
    tails: "tails",
    "פלי": "tails"
  };

  const picked =
    aliases[
      String(
        args[1] || ""
      ).toLowerCase()
    ];

  if (!picked) {
    return message.reply(
      "❌ שימוש: `!coinflip 100 heads`"
    );
  }

  const {
    amount,
    profile
  } = validation;

  profile.xp -= amount;

  const result =
    Math.random() < 0.5
      ? "heads"
      : "tails";

  const won =
    picked === result;

  if (won) {
    profile.xp +=
      amount * 2;
  }

  saveXpData();

  return message.reply(
    [
      result === "heads"
        ? "🪙 **Heads**"
        : "🪙 **Tails**",
      won
        ? `✅ ניצחת **${formatXp(amount)} XP**!`
        : `❌ הפסדת **${formatXp(amount)} XP**.`,
      `💰 יתרה: **${formatXp(profile.xp)} XP**`
    ].join("\n")
  );
}

async function playDice(
  message,
  args
) {
  const cooldown =
    checkCasinoCooldown(
      message.guild.id,
      message.author.id
    );

  if (cooldown > 0) {
    return message.reply(
      `⏳ חכה עוד **${Math.ceil(
        cooldown / 1000
      )} שניות**.`
    );
  }

  const validation =
    validateBet(
      message.guild.id,
      message.author.id,
      args[0]
    );

  if (!validation.ok) {
    return message.reply(
      validation.message
    );
  }

  const picked =
    Number(args[1]);

  if (
    !Number.isInteger(
      picked
    ) ||
    picked < 1 ||
    picked > 6
  ) {
    return message.reply(
      "❌ שימוש: `!dice 100 4`"
    );
  }

  const {
    amount,
    profile
  } = validation;

  profile.xp -= amount;

  const rolled =
    Math.floor(
      Math.random() * 6
    ) + 1;

  const won =
    rolled === picked;

  if (won) {
    profile.xp +=
      amount * 6;
  }

  saveXpData();

  return message.reply(
    [
      `🎲 יצא **${rolled}**`,
      won
        ? `✅ פגעת! זכית ב־**${formatXp(amount * 5)} XP נטו**.`
        : `❌ לא פגעת. הפסדת **${formatXp(amount)} XP**.`,
      `💰 יתרה: **${formatXp(profile.xp)} XP**`
    ].join("\n")
  );
}

async function playSlots(
  message,
  args
) {
  const cooldown =
    checkCasinoCooldown(
      message.guild.id,
      message.author.id
    );

  if (cooldown > 0) {
    return message.reply(
      `⏳ חכה עוד **${Math.ceil(
        cooldown / 1000
      )} שניות**.`
    );
  }

  const validation =
    validateBet(
      message.guild.id,
      message.author.id,
      args[0]
    );

  if (!validation.ok) {
    return message.reply(
      validation.message
    );
  }

  const {
    amount,
    profile
  } = validation;

  profile.xp -= amount;

  const symbols = [
    "🍒",
    "🍋",
    "🍇",
    "🔔",
    "⭐",
    "💎"
  ];

  const spin = [
    symbols[
      Math.floor(
        Math.random() *
        symbols.length
      )
    ],
    symbols[
      Math.floor(
        Math.random() *
        symbols.length
      )
    ],
    symbols[
      Math.floor(
        Math.random() *
        symbols.length
      )
    ]
  ];

  const counts = {};

  for (
    const symbol
    of spin
  ) {
    counts[symbol] =
      (
        counts[symbol] ||
        0
      ) + 1;
  }

  const maxSame =
    Math.max(
      ...Object.values(
        counts
      )
    );

  let payout = 0;
  let resultText = "";

  if (maxSame === 3) {
    payout =
      amount * 6;

    resultText =
      `💎 שלישייה! זכית ב־**${formatXp(amount * 5)} XP נטו**.`;
  } else if (
    maxSame === 2
  ) {
    payout =
      amount * 2;

    resultText =
      `✅ זוג! זכית ב־**${formatXp(amount)} XP נטו**.`;
  } else {
    resultText =
      `❌ אין התאמה. הפסדת **${formatXp(amount)} XP**.`;
  }

  profile.xp += payout;
  saveXpData();

  return message.reply(
    [
      `🎰 | ${spin.join(" | ")} |`,
      resultText,
      `💰 יתרה: **${formatXp(profile.xp)} XP**`
    ].join("\n")
  );
}

async function handleStaffXpCommand(
  message,
  command,
  args
) {
  if (
    !isStaff(
      message.member,
      message.guild
    )
  ) {
    return message.reply(
      "❌ הפקודה הזאת מיועדת לצוות בלבד."
    );
  }

  const target =
    message.mentions.users
      .first();

  const amount =
    parseXpAmount(
      args.find(
        arg =>
          /^\d[\d,]*$/.test(
            arg
          )
      )
    );

  if (
    !target ||
    !amount
  ) {
    return message.reply(
      `❌ שימוש: \`!${command} @user <amount>\``
    );
  }

  const profile =
    getXpProfile(
      message.guild.id,
      target.id
    );

  if (
    command === "addxp"
  ) {
    profile.xp += amount;
  }

  if (
    command === "removexp"
  ) {
    profile.xp =
      Math.max(
        0,
        profile.xp - amount
      );
  }

  if (
    command === "setxp"
  ) {
    profile.xp = amount;
  }

  saveXpData();

  return message.reply(
    `✅ ל־${target} יש עכשיו **${formatXp(profile.xp)} XP**.`
  );
}

// =====================
// MORE SLASH CASINO GAMES + CHALLENGE
// Virtual XP only
// =====================

const activeChallenges =
  new Map();

function slashMessageFromInteraction(
  interaction
) {
  return {
    guild:
      interaction.guild,
    author:
      interaction.user,
    reply:
      payload =>
        interaction.reply(
          payload
        )
  };
}

function casinoEmbed(
  title,
  description,
  user,
  color = "Blue"
) {
  const embed =
    new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(
        description
      )
      .setTimestamp();

  if (user) {
    embed.setThumbnail(
      user.displayAvatarURL({
        size: 256
      })
    );
  }

  embed.setFooter({
    text:
      `${brand()} • Virtual XP Casino`
  });

  return embed;
}

function casinoCooldownReply(
  message,
  cooldown
) {
  return message.reply({
    embeds: [
      casinoEmbed(
        "⏳ Casino Cooldown",
        `חכה עוד **${Math.ceil(
          cooldown / 1000
        )} שניות** לפני משחק נוסף.`,
        message.author,
        "Orange"
      )
    ]
  });
}

async function playRoulette(
  message,
  args
) {
  const cooldown =
    checkCasinoCooldown(
      message.guild.id,
      message.author.id
    );

  if (cooldown > 0) {
    return casinoCooldownReply(
      message,
      cooldown
    );
  }

  const validation =
    validateBet(
      message.guild.id,
      message.author.id,
      args[0]
    );

  if (!validation.ok) {
    return message.reply({
      embeds: [
        casinoEmbed(
          "❌ Roulette",
          validation.message,
          message.author,
          "Red"
        )
      ]
    });
  }

  const picked =
    String(
      args[1] || ""
    ).toLowerCase();

  if (
    ![
      "red",
      "black",
      "green"
    ].includes(
      picked
    )
  ) {
    return message.reply({
      embeds: [
        casinoEmbed(
          "🎡 Roulette",
          "בחר **Red**, **Black** או **Green**.",
          message.author,
          "Orange"
        )
      ]
    });
  }

  const {
    amount,
    profile
  } = validation;

  profile.xp -= amount;

  const number =
    Math.floor(
      Math.random() * 37
    );

  const redNumbers =
    new Set([
      1, 3, 5, 7, 9,
      12, 14, 16, 18,
      19, 21, 23, 25, 27,
      30, 32, 34, 36
    ]);

  const result =
    number === 0
      ? "green"
      : redNumbers.has(number)
        ? "red"
        : "black";

  const won =
    picked === result;

  if (won) {
    profile.xp +=
      result === "green"
        ? amount * 14
        : amount * 2;
  }

  saveXpData();

  const icon =
    result === "red"
      ? "🔴"
      : result === "black"
        ? "⚫"
        : "🟢";

  return message.reply({
    embeds: [
      casinoEmbed(
        "🎡 Roulette",
        [
          `הכדור נפל על **${number} ${icon} ${result.toUpperCase()}**`,
          "",
          won
            ? `✅ זכית! **${formatXp(
                result === "green"
                  ? amount * 13
                  : amount
              )} XP נטו**.`
            : `❌ הפסדת **${formatXp(amount)} XP**.`,
          `💰 יתרה: **${formatXp(profile.xp)} XP**`
        ].join("\n"),
        message.author,
        won ? "Green" : "Red"
      )
    ]
  });
}

async function playHighLow(
  message,
  args
) {
  const cooldown =
    checkCasinoCooldown(
      message.guild.id,
      message.author.id
    );

  if (cooldown > 0) {
    return casinoCooldownReply(
      message,
      cooldown
    );
  }

  const validation =
    validateBet(
      message.guild.id,
      message.author.id,
      args[0]
    );

  if (!validation.ok) {
    return message.reply({
      embeds: [
        casinoEmbed(
          "❌ High / Low",
          validation.message,
          message.author,
          "Red"
        )
      ]
    });
  }

  const guess =
    String(
      args[1] || ""
    ).toLowerCase();

  if (
    ![
      "higher",
      "lower"
    ].includes(
      guess
    )
  ) {
    return message.reply({
      embeds: [
        casinoEmbed(
          "🃏 High / Low",
          "בחר **Higher** או **Lower**.",
          message.author,
          "Orange"
        )
      ]
    });
  }

  const {
    amount,
    profile
  } = validation;

  profile.xp -= amount;

  const first =
    Math.floor(
      Math.random() * 13
    ) + 1;

  const second =
    Math.floor(
      Math.random() * 13
    ) + 1;

  let text = "";
  let color = "Red";

  if (first === second) {
    profile.xp += amount;
    color = "Orange";
    text =
      "🤝 יצא תיקו — ההימור הוחזר.";
  } else {
    const actual =
      second > first
        ? "higher"
        : "lower";

    const won =
      guess === actual;

    if (won) {
      profile.xp +=
        amount * 2;
      color = "Green";
      text =
        `✅ צדקת! זכית ב־**${formatXp(amount)} XP נטו**.`;
    } else {
      text =
        `❌ טעית. הפסדת **${formatXp(amount)} XP**.`;
    }
  }

  saveXpData();

  return message.reply({
    embeds: [
      casinoEmbed(
        "🃏 High / Low",
        [
          `קלף ראשון: **${first}**`,
          `קלף שני: **${second}**`,
          `הבחירה שלך: **${guess.toUpperCase()}**`,
          "",
          text,
          `💰 יתרה: **${formatXp(profile.xp)} XP**`
        ].join("\n"),
        message.author,
        color
      )
    ]
  });
}

async function playRps(
  message,
  args
) {
  const cooldown =
    checkCasinoCooldown(
      message.guild.id,
      message.author.id
    );

  if (cooldown > 0) {
    return casinoCooldownReply(
      message,
      cooldown
    );
  }

  const validation =
    validateBet(
      message.guild.id,
      message.author.id,
      args[0]
    );

  if (!validation.ok) {
    return message.reply({
      embeds: [
        casinoEmbed(
          "❌ Rock Paper Scissors",
          validation.message,
          message.author,
          "Red"
        )
      ]
    });
  }

  const picked =
    String(
      args[1] || ""
    ).toLowerCase();

  const choices = [
    "rock",
    "paper",
    "scissors"
  ];

  if (
    !choices.includes(
      picked
    )
  ) {
    return message.reply({
      embeds: [
        casinoEmbed(
          "✊✋✌️ RPS",
          "בחר Rock, Paper או Scissors.",
          message.author,
          "Orange"
        )
      ]
    });
  }

  const {
    amount,
    profile
  } = validation;

  profile.xp -= amount;

  const botChoice =
    choices[
      Math.floor(
        Math.random() *
        choices.length
      )
    ];

  const emoji = {
    rock: "✊",
    paper: "✋",
    scissors: "✌️"
  };

  let text = "";
  let color = "Red";

  if (
    picked === botChoice
  ) {
    profile.xp += amount;
    color = "Orange";
    text =
      "🤝 תיקו — ה־XP הוחזר.";
  } else {
    const won =
      (
        picked === "rock" &&
        botChoice === "scissors"
      ) ||
      (
        picked === "paper" &&
        botChoice === "rock"
      ) ||
      (
        picked === "scissors" &&
        botChoice === "paper"
      );

    if (won) {
      profile.xp +=
        amount * 2;
      color = "Green";
      text =
        `✅ ניצחת **${formatXp(amount)} XP נטו**!`;
    } else {
      text =
        `❌ הפסדת **${formatXp(amount)} XP**.`;
    }
  }

  saveXpData();

  return message.reply({
    embeds: [
      casinoEmbed(
        "✊✋✌️ Rock Paper Scissors",
        [
          `אתה: ${emoji[picked]} **${picked}**`,
          `הבוט: ${emoji[botChoice]} **${botChoice}**`,
          "",
          text,
          `💰 יתרה: **${formatXp(profile.xp)} XP**`
        ].join("\n"),
        message.author,
        color
      )
    ]
  });
}

async function playNumberGuess(
  message,
  args
) {
  const cooldown =
    checkCasinoCooldown(
      message.guild.id,
      message.author.id
    );

  if (cooldown > 0) {
    return casinoCooldownReply(
      message,
      cooldown
    );
  }

  const validation =
    validateBet(
      message.guild.id,
      message.author.id,
      args[0]
    );

  if (!validation.ok) {
    return message.reply({
      embeds: [
        casinoEmbed(
          "❌ Lucky Number",
          validation.message,
          message.author,
          "Red"
        )
      ]
    });
  }

  const picked =
    Number(
      args[1]
    );

  if (
    !Number.isInteger(
      picked
    ) ||
    picked < 1 ||
    picked > 10
  ) {
    return message.reply({
      embeds: [
        casinoEmbed(
          "🔢 Lucky Number",
          "בחר מספר בין **1 ל־10**.",
          message.author,
          "Orange"
        )
      ]
    });
  }

  const {
    amount,
    profile
  } = validation;

  profile.xp -= amount;

  const result =
    Math.floor(
      Math.random() * 10
    ) + 1;

  const won =
    picked === result;

  if (won) {
    profile.xp +=
      amount * 10;
  }

  saveXpData();

  return message.reply({
    embeds: [
      casinoEmbed(
        "🔢 Lucky Number",
        [
          `בחרת: **${picked}**`,
          `המספר שיצא: **${result}**`,
          "",
          won
            ? `🎉 JACKPOT קטן! זכית ב־**${formatXp(amount * 9)} XP נטו**.`
            : `❌ לא פגעת. הפסדת **${formatXp(amount)} XP**.`,
          `💰 יתרה: **${formatXp(profile.xp)} XP**`
        ].join("\n"),
        message.author,
        won ? "Green" : "Red"
      )
    ]
  });
}

async function playWheel(
  message,
  args
) {
  const cooldown =
    checkCasinoCooldown(
      message.guild.id,
      message.author.id
    );

  if (cooldown > 0) {
    return casinoCooldownReply(
      message,
      cooldown
    );
  }

  const validation =
    validateBet(
      message.guild.id,
      message.author.id,
      args[0]
    );

  if (!validation.ok) {
    return message.reply({
      embeds: [
        casinoEmbed(
          "❌ Lucky Wheel",
          validation.message,
          message.author,
          "Red"
        )
      ]
    });
  }

  const {
    amount,
    profile
  } = validation;

  profile.xp -= amount;

  const multipliers = [
    0,
    0,
    0.5,
    0.5,
    1,
    1,
    1.5,
    2,
    3
  ];

  const multiplier =
    multipliers[
      Math.floor(
        Math.random() *
        multipliers.length
      )
    ];

  const payout =
    Math.floor(
      amount * multiplier
    );

  profile.xp +=
    payout;

  saveXpData();

  const net =
    payout - amount;

  return message.reply({
    embeds: [
      casinoEmbed(
        "🎡 Lucky Wheel",
        [
          `המכפיל שיצא: **x${multiplier}**`,
          `החזר: **${formatXp(payout)} XP**`,
          "",
          net > 0
            ? `✅ רווח: **+${formatXp(net)} XP**`
            : net === 0
              ? "🤝 יצאת בלי רווח ובלי הפסד."
              : `❌ הפסד: **${formatXp(Math.abs(net))} XP**`,
          `💰 יתרה: **${formatXp(profile.xp)} XP**`
        ].join("\n"),
        message.author,
        net > 0
          ? "Green"
          : net === 0
            ? "Orange"
            : "Red"
      )
    ]
  });
}

async function playJackpot(
  message,
  args
) {
  const cooldown =
    checkCasinoCooldown(
      message.guild.id,
      message.author.id
    );

  if (cooldown > 0) {
    return casinoCooldownReply(
      message,
      cooldown
    );
  }

  const validation =
    validateBet(
      message.guild.id,
      message.author.id,
      args[0]
    );

  if (!validation.ok) {
    return message.reply({
      embeds: [
        casinoEmbed(
          "❌ Jackpot",
          validation.message,
          message.author,
          "Red"
        )
      ]
    });
  }

  const {
    amount,
    profile
  } = validation;

  profile.xp -= amount;

  const roll =
    Math.floor(
      Math.random() * 20
    ) + 1;

  const won =
    roll === 7;

  if (won) {
    profile.xp +=
      amount * 15;
  }

  saveXpData();

  return message.reply({
    embeds: [
      casinoEmbed(
        "🎰 Mega Jackpot",
        [
          `Lucky Roll: **${roll}/20**`,
          "",
          won
            ? `👑 **JACKPOT!** זכית ב־**${formatXp(amount * 14)} XP נטו**!`
            : `❌ לא הפעם. הפסדת **${formatXp(amount)} XP**.`,
          `💰 יתרה: **${formatXp(profile.xp)} XP**`
        ].join("\n"),
        message.author,
        won ? "Gold" : "Red"
      )
    ]
  });
}

function buildLeaderboardEmbed(
  guildId
) {
  const guildData =
    getGuildXpData(
      guildId
    );

  const top =
    Object.entries(
      guildData.users || {}
    )
      .sort(
        (
          [, a],
          [, b]
        ) =>
          Number(b.xp || 0) -
          Number(a.xp || 0)
      )
      .slice(
        0,
        10
      );

  const medals = [
    "🥇",
    "🥈",
    "🥉"
  ];

  const lines =
    top.length
      ? top.map(
          ([userId, profile], index) =>
            `${medals[index] || `**${index + 1}.**`} <@${userId}> — **${formatXp(profile.xp)} XP**`
        )
      : [
          "עדיין אין נתוני XP."
        ];

  return new EmbedBuilder()
    .setColor("Gold")
    .setTitle(
      `🏆 ${brand()} • XP Leaderboard`
    )
    .setDescription(
      lines.join("\n")
    )
    .setFooter({
      text:
        `${brand()} • Top 10`
    })
    .setTimestamp();
}

function challengeButtons(
  id,
  disabled = false
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `challenge_accept:${id}`
          )
          .setLabel(
            "קבל את האתגר"
          )
          .setEmoji("✅")
          .setStyle(
            ButtonStyle.Success
          )
          .setDisabled(
            disabled
          ),

        new ButtonBuilder()
          .setCustomId(
            `challenge_decline:${id}`
          )
          .setLabel(
            "דחה"
          )
          .setEmoji("❌")
          .setStyle(
            ButtonStyle.Danger
          )
          .setDisabled(
            disabled
          )
      )
  ];
}

async function createChallenge(
  interaction
) {
  const target =
    interaction.options
      .getUser(
        "user",
        true
      );

  const amount =
    interaction.options
      .getInteger(
        "amount",
        true
      );

  if (
    target.id ===
      interaction.user.id
  ) {
    return interaction.reply({
      content:
        "❌ אי אפשר לאתגר את עצמך.",
      flags:
        MessageFlags.Ephemeral
    });
  }

  if (target.bot) {
    return interaction.reply({
      content:
        "❌ אי אפשר לאתגר בוט.",
      flags:
        MessageFlags.Ephemeral
    });
  }

  if (
    amount >
      getMaxCasinoBet()
  ) {
    return interaction.reply({
      content:
        `❌ המקסימום ל־Challenge הוא **${formatXp(getMaxCasinoBet())} XP**.`,
      flags:
        MessageFlags.Ephemeral
    });
  }

  const challengerProfile =
    getXpProfile(
      interaction.guild.id,
      interaction.user.id
    );

  const targetProfile =
    getXpProfile(
      interaction.guild.id,
      target.id
    );

  if (
    challengerProfile.xp <
      amount
  ) {
    return interaction.reply({
      content:
        `❌ אין לך מספיק XP. יש לך **${formatXp(challengerProfile.xp)} XP**.`,
      flags:
        MessageFlags.Ephemeral
    });
  }

  if (
    targetProfile.xp <
      amount
  ) {
    return interaction.reply({
      content:
        `❌ ל־${target} אין מספיק XP כדי לקבל את האתגר הזה.`,
      flags:
        MessageFlags.Ephemeral
    });
  }

  const alreadyOpen =
    [...activeChallenges.values()]
      .some(
        challenge =>
          challenge.guildId ===
            interaction.guild.id &&
          challenge.status ===
            "pending" &&
          (
            (
              challenge.challengerId ===
                interaction.user.id &&
              challenge.targetId ===
                target.id
            ) ||
            (
              challenge.challengerId ===
                target.id &&
              challenge.targetId ===
                interaction.user.id
            )
          )
      );

  if (alreadyOpen) {
    return interaction.reply({
      content:
        "❌ כבר יש ביניכם Challenge פתוח.",
      flags:
        MessageFlags.Ephemeral
    });
  }

  const id =
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  activeChallenges.set(
    id,
    {
      id,
      guildId:
        interaction.guild.id,
      challengerId:
        interaction.user.id,
      targetId:
        target.id,
      amount,
      createdAt:
        Date.now(),
      status:
        "pending"
    }
  );

  const response =
    await interaction.reply({
      content:
        `⚔️ ${target}, ${interaction.user} אתגר אותך להימור על **${formatXp(amount)} XP**!`,
      components:
        challengeButtons(
          id
        ),
      allowedMentions: {
        users: [
          target.id,
          interaction.user.id
        ]
      },
      fetchReply: true
    });

  setTimeout(
    async () => {
      const challenge =
        activeChallenges.get(
          id
        );

      if (
        !challenge ||
        challenge.status !==
          "pending"
      ) {
        return;
      }

      activeChallenges.delete(
        id
      );

      await response.edit({
        content:
          `⌛ האתגר של <@${challenge.challengerId}> ל־<@${challenge.targetId}> על **${formatXp(challenge.amount)} XP** פג.`,
        components:
          challengeButtons(
            id,
            true
          ),
        allowedMentions: {
          users: []
        }
      }).catch(
        () => {}
      );
    },
    60 * 1000
  );

  return;
}

async function handleChallengeButton(
  interaction,
  action,
  id
) {
  const challenge =
    activeChallenges.get(
      id
    );

  if (!challenge) {
    return interaction.reply({
      content:
        "❌ האתגר כבר לא פעיל.",
      flags:
        MessageFlags.Ephemeral
    });
  }

  if (
    interaction.user.id !==
      challenge.targetId
  ) {
    return interaction.reply({
      content:
        "❌ רק המשתמש שאותגר יכול להשתמש בכפתורים האלה.",
      flags:
        MessageFlags.Ephemeral
    });
  }

  if (
    Date.now() -
      challenge.createdAt >
      60 * 1000
  ) {
    activeChallenges.delete(
      id
    );

    return interaction.update({
      content:
        `⌛ האתגר של <@${challenge.challengerId}> ל־<@${challenge.targetId}> על **${formatXp(challenge.amount)} XP** פג.`,
      components:
        challengeButtons(
          id,
          true
        ),
      allowedMentions: {
        users: []
      }
    });
  }

  if (
    action === "decline"
  ) {
    activeChallenges.delete(
      id
    );

    return interaction.update({
      content:
        `❌ <@${challenge.targetId}> דחה את האתגר של <@${challenge.challengerId}> על **${formatXp(challenge.amount)} XP**.`,
      components:
        challengeButtons(
          id,
          true
        ),
      allowedMentions: {
        users: []
      }
    });
  }

  if (
    challenge.status !==
      "pending"
  ) {
    return interaction.reply({
      content:
        "⏳ האתגר כבר מתבצע.",
      flags:
        MessageFlags.Ephemeral
    });
  }

  challenge.status =
    "resolving";

  const challengerProfile =
    getXpProfile(
      challenge.guildId,
      challenge.challengerId
    );

  const targetProfile =
    getXpProfile(
      challenge.guildId,
      challenge.targetId
    );

  if (
    challengerProfile.xp <
      challenge.amount ||
    targetProfile.xp <
      challenge.amount
  ) {
    activeChallenges.delete(
      id
    );

    return interaction.update({
      content:
        "❌ האתגר בוטל כי לאחד המשתמשים כבר אין מספיק XP.",
      components:
        challengeButtons(
          id,
          true
        )
    });
  }

  challengerProfile.xp -=
    challenge.amount;

  targetProfile.xp -=
    challenge.amount;

  const challengerWon =
    Math.random() < 0.5;

  const winnerId =
    challengerWon
      ? challenge.challengerId
      : challenge.targetId;

  const loserId =
    challengerWon
      ? challenge.targetId
      : challenge.challengerId;

  const winnerProfile =
    challengerWon
      ? challengerProfile
      : targetProfile;

  winnerProfile.xp +=
    challenge.amount * 2;

  saveXpData();

  activeChallenges.delete(
    id
  );

  return interaction.update({
    content: "",
    embeds: [
      new EmbedBuilder()
        .setColor("Gold")
        .setTitle(
          "🏆 Challenge הסתיים!"
        )
        .setDescription(
          [
            `⚔️ <@${challenge.challengerId}> **VS** <@${challenge.targetId}>`,
            "",
            `🪙 **הימור:** ${formatXp(challenge.amount)} XP לכל שחקן`,
            "",
            `👑 **מנצח:** <@${winnerId}>`,
            `💀 **מפסיד:** <@${loserId}>`,
            "",
            `💰 המנצח קיבל את הקופה: **${formatXp(challenge.amount * 2)} XP**`,
            `📈 רווח נטו: **${formatXp(challenge.amount)} XP**`
          ].join("\n")
        )
        .setFooter({
          text:
            `${brand()} • XP Challenge`
        })
        .setTimestamp()
    ],
    components:
      challengeButtons(
        id,
        true
      ),
    allowedMentions: {
      users: []
    }
  });
}


// =====================
// HELP SYSTEM - ZONE X STYLE
// =====================

const helpCooldowns =
  new Map();

async function sendHelpRequest(
  message,
  reason
) {
  const key =
    `${message.guild.id}:${message.author.id}`;

  const last =
    helpCooldowns.get(
      key
    ) || 0;

  const cooldownMs =
    30 * 1000;

  if (
    Date.now() - last <
    cooldownMs
  ) {
    const left =
      Math.ceil(
        (
          cooldownMs -
          (
            Date.now() -
            last
          )
        ) / 1000
      );

    return message.reply(
      `⏳ חכה עוד ${left} שניות לפני Help נוסף.`
    );
  }

  helpCooldowns.set(
    key,
    Date.now()
  );

  const createdAt =
    Date.now();

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("Blue")
        .setTitle(
          `🆘 ${brand()} • Help Center`
        )
        .setDescription(
          [
            "### בקשת עזרה חדשה 🆘",
            "",
            `👤 **משתמש:** ${message.author}`,
            `📝 **סיבה:** ${reason || "לא נכתבה סיבה"}`,
            `🎙️ **Voice:** ${
              message.member?.voice?.channel
                ? `${message.member.voice.channel}`
                : "לא מחובר לוויס"
            }`,
            "",
            "📌 **סטטוס:** ממתין לצוות",
            "🛡️ **מטפל:** עדיין לא נלקח"
          ].join("\n")
        )
        .setFooter({
          text:
            `Help ID • ${createdAt}`
        })
        .setTimestamp()
    ],

    components: [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `help_claim:${message.author.id}:${createdAt}`
            )
            .setLabel(
              "בטיפול"
            )
            .setEmoji("🛡️")
            .setStyle(
              ButtonStyle.Primary
            )
        )
    ]
  });
}

// =====================
// MESSAGE COMMANDS
// =====================

client.on(
  Events.MessageCreate,
  async message => {
    try {
      if (
        !message.guild ||
        message.author.bot
      ) {
        return;
      }

      const prefix =
        String(
          config.xpPrefix ||
          "!"
        );

      const content =
        String(
          message.content ||
          ""
        ).trim();

      // הודעות רגילות צוברות XP.
      // פקודות Prefix לא.
      if (
        !content.startsWith(
          prefix
        )
      ) {
        awardMessageXp(
          message
        );

        return;
      }

      const withoutPrefix =
        content
          .slice(
            prefix.length
          )
          .trim();

      if (!withoutPrefix) {
        return;
      }

      const parts =
        withoutPrefix
          .split(/\s+/);

      const command =
        String(
          parts.shift() ||
          ""
        ).toLowerCase();

      const args =
        parts;

      // ---------- HELP ----------

      if (
        command === "h"
      ) {
        const reason =
          args.join(" ")
            .trim();

        return sendHelpRequest(
          message,
          reason
        );
      }

      // ---------- XP INFO ----------

      if (
        command === "xphelp"
      ) {
        return message.reply({
          embeds: [
            buildXpHelpEmbed()
          ]
        });
      }

      if (
        command === "xp" ||
        command === "balance" ||
        command === "bal"
      ) {
        const profile =
          getXpProfile(
            message.guild.id,
            message.author.id
          );

        return message.reply(
          `💰 יש לך **${formatXp(profile.xp)} XP**.`
        );
      }

      // ---------- STAFF XP ----------

      if (
        command === "addxp" ||
        command === "removexp" ||
        command === "setxp"
      ) {
        return handleStaffXpCommand(
          message,
          command,
          args
        );
      }

    } catch (error) {
      console.error(
        "❌ Message command error:",
        error
      );

      return message.reply(
        "❌ הייתה שגיאה בפקודה."
      ).catch(
        () => {}
      );
    }
  }
);

// =====================
// READY
// =====================

client.once(
  Events.ClientReady,
  readyClient => {
    console.log(
      `✅ ${brand()} online as ${readyClient.user.tag}`
    );
  }
);

// =====================
// INTERACTIONS
// =====================

client.on(
  Events.InteractionCreate,
  async interaction => {
    try {
      // ---------- SLASH ----------

      if (
        interaction.isChatInputCommand()
      ) {
        if (
          interaction.commandName ===
          "casino"
        ) {
          return interaction.reply({
            embeds: [
              buildXpHelpEmbed()
            ]
          });
        }

        if (
          interaction.commandName ===
          "xp"
        ) {
          const profile =
            getXpProfile(
              interaction.guild.id,
              interaction.user.id
            );

          return interaction.reply({
            embeds: [
              casinoEmbed(
                "💰 XP Balance",
                `יש לך **${formatXp(profile.xp)} XP**.`,
                interaction.user,
                "Gold"
              )
            ]
          });
        }

        if (
          interaction.commandName ===
          "leaderboard"
        ) {
          return interaction.reply({
            embeds: [
              buildLeaderboardEmbed(
                interaction.guild.id
              )
            ]
          });
        }

        if (
          interaction.commandName ===
          "coinflip"
        ) {
          const amount =
            interaction.options
              .getInteger(
                "amount",
                true
              );

          const side =
            interaction.options
              .getString(
                "side",
                true
              );

          return playCoinflip(
            slashMessageFromInteraction(
              interaction
            ),
            [
              String(amount),
              side
            ]
          );
        }

        if (
          interaction.commandName ===
          "dice"
        ) {
          const amount =
            interaction.options
              .getInteger(
                "amount",
                true
              );

          const number =
            interaction.options
              .getInteger(
                "number",
                true
              );

          return playDice(
            slashMessageFromInteraction(
              interaction
            ),
            [
              String(amount),
              String(number)
            ]
          );
        }

        if (
          interaction.commandName ===
          "slots"
        ) {
          const amount =
            interaction.options
              .getInteger(
                "amount",
                true
              );

          return playSlots(
            slashMessageFromInteraction(
              interaction
            ),
            [
              String(amount)
            ]
          );
        }

        if (
          interaction.commandName ===
          "roulette"
        ) {
          const amount =
            interaction.options
              .getInteger(
                "amount",
                true
              );

          const color =
            interaction.options
              .getString(
                "color",
                true
              );

          return playRoulette(
            slashMessageFromInteraction(
              interaction
            ),
            [
              String(amount),
              color
            ]
          );
        }

        if (
          interaction.commandName ===
          "highlow"
        ) {
          const amount =
            interaction.options
              .getInteger(
                "amount",
                true
              );

          const guess =
            interaction.options
              .getString(
                "guess",
                true
              );

          return playHighLow(
            slashMessageFromInteraction(
              interaction
            ),
            [
              String(amount),
              guess
            ]
          );
        }

        if (
          interaction.commandName ===
          "rps"
        ) {
          const amount =
            interaction.options
              .getInteger(
                "amount",
                true
              );

          const choice =
            interaction.options
              .getString(
                "choice",
                true
              );

          return playRps(
            slashMessageFromInteraction(
              interaction
            ),
            [
              String(amount),
              choice
            ]
          );
        }

        if (
          interaction.commandName ===
          "number"
        ) {
          const amount =
            interaction.options
              .getInteger(
                "amount",
                true
              );

          const number =
            interaction.options
              .getInteger(
                "number",
                true
              );

          return playNumberGuess(
            slashMessageFromInteraction(
              interaction
            ),
            [
              String(amount),
              String(number)
            ]
          );
        }

        if (
          interaction.commandName ===
          "wheel"
        ) {
          const amount =
            interaction.options
              .getInteger(
                "amount",
                true
              );

          return playWheel(
            slashMessageFromInteraction(
              interaction
            ),
            [
              String(amount)
            ]
          );
        }

        if (
          interaction.commandName ===
          "jackpot"
        ) {
          const amount =
            interaction.options
              .getInteger(
                "amount",
                true
              );

          return playJackpot(
            slashMessageFromInteraction(
              interaction
            ),
            [
              String(amount)
            ]
          );
        }

        if (
          interaction.commandName ===
          "challenge"
        ) {
          return createChallenge(
            interaction
          );
        }

        if (
          interaction.commandName ===
          "setup-xp-shop"
        ) {
          if (
            !isManagement(
              interaction.member,
              interaction.guild
            )
          ) {
            return interaction.reply({
              content:
                "❌ רק הנהלה יכולה לשלוח את XP Shop.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          const panel =
            buildXpShopPanel();

          if (!panel) {
            return interaction.reply({
              content:
                "❌ אין פריטים תקינים ב־`xpShop` ב־config.js.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          await interaction.channel.send(
            panel
          );

          return interaction.reply({
            content:
              "✅ פאנל ה־XP Shop נשלח.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        if (
          interaction.commandName ===
          "ticket-panel"
        ) {
          if (
            !isStaff(
              interaction.member,
              interaction.guild
            )
          ) {
            return interaction.reply({
              content:
                "❌ אין לך גישה.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          await interaction.channel.send(
            ticketPanel()
          );

          return interaction.reply({
            content:
              "✅ פאנל הטיקטים נשלח.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        if (
          interaction.commandName ===
          "setup-verify"
        ) {
          if (
            !isManagement(
              interaction.member,
              interaction.guild
            )
          ) {
            return interaction.reply({
              content:
                "❌ רק הנהלה יכולה להריץ את Setup ה־Verify.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          await interaction.deferReply({
            flags:
              MessageFlags.Ephemeral
          });

          try {
            const result =
              await setupVerify(
                interaction
              );

            await interaction.channel.send(
              verifyPanel()
            );

            return interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor(
                    result.failed
                      ? "Orange"
                      : "Green"
                  )
                  .setTitle(
                    "✅ Verify Setup הושלם"
                  )
                  .setDescription(
                    [
                      `🔐 חדרים שטופלו: **${result.managed}**`,
                      `💬 חדרים שבהם Members יכולים לכתוב: **${result.writable}**`,
                      `📖 חדרי טקסט Read Only: **${result.readOnly}**`,
                      `⚠️ שגיאות: **${result.failed}**`,
                      "",
                      `✅ Verify: ${result.verifyChannel}`,
                      `👥 Member: ${result.memberRole}`,
                      "",
                      "חדרים שכבר היו פרטיים ולא הופיעו ברשימת הכתיבה נשארו פרטיים."
                    ].join("\n")
                  )
                  .setTimestamp()
              ]
            });
          } catch (error) {
            console.error(
              "❌ setup-verify:",
              error
            );

            const map = {
              VERIFY_CHANNEL_INVALID:
                "❌ תריץ את `/setup-verify` בתוך חדר ה־Verify.",
              MEMBER_ROLE_MISSING:
                "❌ חסר `memberRoleId` ב־config.js.",
              MEMBER_ROLE_NOT_FOUND:
                "❌ רול Member לא נמצא.",
              NO_MANAGE_CHANNELS:
                "❌ לבוט חסר `Manage Channels`.",
              NO_MANAGE_ROLES:
                "❌ לבוט חסר `Manage Roles`.",
              BOT_ROLE_TOO_LOW:
                "❌ רול הבוט חייב להיות מעל רול Member."
            };

            return interaction.editReply({
              content:
                map[error.message] ||
                "❌ הייתה שגיאה בזמן Setup Verify."
            });
          }
        }

        if (
          interaction.commandName ===
          "verify-panel"
        ) {
          if (
            !isManagement(
              interaction.member,
              interaction.guild
            )
          ) {
            return interaction.reply({
              content:
                "❌ רק הנהלה יכולה לשלוח את הפאנל.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          await interaction.channel.send(
            verifyPanel()
          );

          return interaction.reply({
            content:
              "✅ פאנל Verify נשלח.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        // ---------- MANAGEMENT MODERATION ----------

        if (
          interaction.commandName ===
          "timeout"
        ) {
          if (
            !isManagement(
              interaction.member,
              interaction.guild
            )
          ) {
            return interaction.reply({
              content:
                "❌ הפקודה מיועדת להנהלה בלבד.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          const user =
            interaction.options
              .getUser(
                "user",
                true
              );

          const durationValue =
            interaction.options
              .getString(
                "duration",
                true
              );

          const reason =
            interaction.options
              .getString(
                "reason"
              ) ||
            "לא צוינה סיבה";

          const duration =
            parseDuration(
              durationValue
            );

          const member =
            await interaction.guild.members
              .fetch(
                user.id
              )
              .catch(
                () => null
              );

          if (
            !member ||
            !duration
          ) {
            return interaction.reply({
              content:
                "❌ המשתמש או הזמן לא תקינים.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            !member.moderatable ||
            member.id ===
              interaction.guild.ownerId ||
            member.permissions.has(
              PermissionFlagsBits.Administrator
            )
          ) {
            return interaction.reply({
              content:
                "❌ הבוט לא יכול לתת Timeout למשתמש הזה.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          await member.timeout(
            duration,
            `${reason} | By ${interaction.user.tag}`
          );

          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("Orange")
                .setTitle(
                  "⏳ Timeout"
                )
                .addFields(
                  {
                    name:
                      "משתמש",
                    value:
                      `${user}`,
                    inline: true
                  },
                  {
                    name:
                      "זמן",
                    value:
                      formatDuration(
                        duration
                      ),
                    inline: true
                  },
                  {
                    name:
                      "הנהלה",
                    value:
                      `${interaction.user}`,
                    inline: true
                  },
                  {
                    name:
                      "סיבה",
                    value:
                      reason
                  }
                )
                .setTimestamp()
            ]
          });
        }

        if (
          interaction.commandName ===
          "untimeout"
        ) {
          if (
            !isManagement(
              interaction.member,
              interaction.guild
            )
          ) {
            return interaction.reply({
              content:
                "❌ הפקודה מיועדת להנהלה בלבד.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          const user =
            interaction.options
              .getUser(
                "user",
                true
              );

          const member =
            await interaction.guild.members
              .fetch(
                user.id
              )
              .catch(
                () => null
              );

          if (!member) {
            return interaction.reply({
              content:
                "❌ המשתמש לא נמצא.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          await member.timeout(
            null,
            `Removed by ${interaction.user.tag}`
          );

          return interaction.reply({
            content:
              `✅ ה־Timeout של ${user} הוסר.`
          });
        }

        if (
          interaction.commandName ===
          "clear"
        ) {
          if (
            !isManagement(
              interaction.member,
              interaction.guild
            )
          ) {
            return interaction.reply({
              content:
                "❌ הפקודה מיועדת להנהלה בלבד.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          const amount =
            interaction.options
              .getInteger(
                "amount",
                true
              );

          if (
            !interaction.channel ||
            typeof interaction.channel.bulkDelete !==
              "function"
          ) {
            return interaction.reply({
              content:
                "❌ אי אפשר למחוק הודעות בחדר הזה.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          await interaction.deferReply({
            flags:
              MessageFlags.Ephemeral
          });

          const deleted =
            await interaction.channel
              .bulkDelete(
                amount,
                true
              );

          return interaction.editReply({
            content:
              `✅ נמחקו **${deleted.size}** הודעות.`
          });
        }
      }

      // ---------- CHALLENGE BUTTONS ----------

      if (
        interaction.isButton() &&
        interaction.customId.startsWith(
          "challenge_accept:"
        )
      ) {
        const id =
          interaction.customId
            .split(":")
            .slice(1)
            .join(":");

        return handleChallengeButton(
          interaction,
          "accept",
          id
        );
      }

      if (
        interaction.isButton() &&
        interaction.customId.startsWith(
          "challenge_decline:"
        )
      ) {
        const id =
          interaction.customId
            .split(":")
            .slice(1)
            .join(":");

        return handleChallengeButton(
          interaction,
          "decline",
          id
        );
      }

      // ---------- XP SHOP ----------

      if (
        interaction.isButton() &&
        interaction.customId.startsWith(
          "xp_shop_buy:"
        )
      ) {
        const itemKey =
          interaction.customId
            .split(":")
            .slice(1)
            .join(":");

        return buyXpRoleFromButton(
          interaction,
          itemKey
        );
      }

      // ---------- VERIFY BUTTON ----------

      if (
        interaction.isButton() &&
        interaction.customId ===
          "verify_member"
      ) {
        const memberRole =
          await interaction.guild.roles
            .fetch(
              config.memberRoleId
            )
            .catch(
              () => null
            );

        const member =
          await interaction.guild.members
            .fetch(
              interaction.user.id
            );

        const botMember =
          await interaction.guild.members
            .fetchMe();

        if (
          !memberRole ||
          memberRole.managed ||
          memberRole.position >=
            botMember.roles.highest.position ||
          !botMember.permissions.has(
            PermissionFlagsBits.ManageRoles
          )
        ) {
          return interaction.reply({
            content:
              "❌ הבוט לא יכול לתת את רול ה־Member.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        if (
          member.roles.cache.has(
            memberRole.id
          )
        ) {
          return interaction.reply({
            content:
              "✅ אתה כבר מאומת.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        await member.roles.add(
          memberRole,
          `${brand()} Verify`
        );

        return interaction.reply({
          content:
            "✅ אומתת בהצלחה! קיבלת גישה לשרת.",
          flags:
            MessageFlags.Ephemeral
        });
      }

      // ---------- HELP CLAIM ----------

      if (
        interaction.isButton() &&
        interaction.customId.startsWith(
          "help_claim:"
        )
      ) {
        if (
          !isStaff(
            interaction.member,
            interaction.guild
          )
        ) {
          return interaction.reply({
            content:
              "❌ רק צוות יכול לקחת Help.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        const [
          ,
          requesterId
        ] =
          interaction.customId
            .split(":");

        const original =
          interaction.message.embeds[0];

        const updatedDescription =
          String(
            original.description || ""
          )
            .replace(
              "📌 **סטטוס:** ממתין לצוות",
              "📌 **סטטוס:** ✅ בטיפול"
            )
            .replace(
              "🛡️ **מטפל:** עדיין לא נלקח",
              `🛡️ **מטפל:** ${interaction.user}`
            );

        const embed =
          EmbedBuilder.from(
            original
          )
            .setColor("Green")
            .setDescription(
              updatedDescription
            );

        return interaction.update({
          embeds: [
            embed
          ],
          components: [
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    `help_claimed:${interaction.user.id}`
                  )
                  .setLabel(
                    `בטיפול • ${interaction.user.username}`
                  )
                  .setEmoji("✅")
                  .setStyle(
                    ButtonStyle.Success
                  )
                  .setDisabled(true)
              )
          ]
        });
      }

      // ---------- OPEN TICKET ----------

      if (
        interaction.isButton() &&
        interaction.customId.startsWith(
          "ticket_open:"
        )
      ) {
        const type =
          interaction.customId
            .split(":")[1];

        return openTicket(
          interaction,
          type
        );
      }

      // ---------- CLAIM TICKET ----------

      if (
        interaction.isButton() &&
        interaction.customId ===
          "ticket_claim"
      ) {
        if (
          !isStaff(
            interaction.member,
            interaction.guild
          )
        ) {
          return interaction.reply({
            content:
              "❌ רק צוות יכול לקחת טיקט.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        const data =
          parseTicketTopic(
            interaction.channel
          );

        if (data.claimed) {
          return interaction.reply({
            content:
              `❌ הטיקט כבר נלקח על ידי <@${data.claimed}>.`,
            flags:
              MessageFlags.Ephemeral
          });
        }

        data.claimed =
          interaction.user.id;

        await interaction.channel
          .setTopic(
            ticketTopic({
              owner:
                data.owner,
              type:
                data.type,
              claimed:
                data.claimed
            })
          );

        await interaction.update({
          embeds: [
            ticketStatusEmbed(
              interaction.message.embeds[0],
              interaction.user.id
            )
          ],
          components:
            ticketControls(
              interaction.user.id
            )
        });

        await interaction.channel.send({
          content:
            `🛡️ הטיקט נלקח על ידי ${interaction.user}.`
        });

        return;
      }

      // ---------- RELEASE TICKET ----------

      if (
        interaction.isButton() &&
        interaction.customId ===
          "ticket_release"
      ) {
        if (
          !isStaff(
            interaction.member,
            interaction.guild
          )
        ) {
          return interaction.reply({
            content:
              "❌ רק צוות יכול לשחרר טיקט.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        const data =
          parseTicketTopic(
            interaction.channel
          );

        if (
          data.claimed &&
          data.claimed !==
            interaction.user.id &&
          !isManagement(
            interaction.member,
            interaction.guild
          )
        ) {
          return interaction.reply({
            content:
              "❌ רק מי שלקח את הטיקט או הנהלה יכולים לשחרר אותו.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        await interaction.channel
          .setTopic(
            ticketTopic({
              owner:
                data.owner,
              type:
                data.type,
              claimed: ""
            })
          );

        await interaction.update({
          embeds: [
            ticketStatusEmbed(
              interaction.message.embeds[0],
              ""
            )
          ],
          components:
            ticketControls()
        });

        await interaction.channel.send({
          content:
            `🔓 ${interaction.user} שחרר את הטיקט.`
        });

        return;
      }

      // ---------- ADD / REMOVE USER ----------

      if (
        interaction.isButton() &&
        (
          interaction.customId ===
            "ticket_add_user" ||
          interaction.customId ===
            "ticket_remove_user"
        )
      ) {
        if (
          !isStaff(
            interaction.member,
            interaction.guild
          )
        ) {
          return interaction.reply({
            content:
              "❌ רק צוות יכול להשתמש בזה.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        const adding =
          interaction.customId ===
          "ticket_add_user";

        const modal =
          new ModalBuilder()
            .setCustomId(
              adding
                ? "ticket_add_user_modal"
                : "ticket_remove_user_modal"
            )
            .setTitle(
              adding
                ? "Add User"
                : "Remove User"
            );

        const input =
          new TextInputBuilder()
            .setCustomId(
              "user_id"
            )
            .setLabel(
              "User ID"
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(
              true
            );

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(
              input
            )
        );

        return interaction.showModal(
          modal
        );
      }

      // ---------- CLOSE TICKET ----------

      if (
        interaction.isButton() &&
        interaction.customId ===
          "ticket_close"
      ) {
        if (
          !isStaff(
            interaction.member,
            interaction.guild
          )
        ) {
          return interaction.reply({
            content:
              "❌ רק צוות יכול לסגור טיקט.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        const modal =
          new ModalBuilder()
            .setCustomId(
              "ticket_close_modal"
            )
            .setTitle(
              "Close Ticket"
            );

        const input =
          new TextInputBuilder()
            .setCustomId(
              "reason"
            )
            .setLabel(
              "סיבת סגירה"
            )
            .setStyle(
              TextInputStyle.Paragraph
            )
            .setMaxLength(
              500
            )
            .setRequired(
              true
            );

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(
              input
            )
        );

        return interaction.showModal(
          modal
        );
      }

      // ---------- MODALS ----------

      if (
        interaction.isModalSubmit()
      ) {
        if (
          interaction.customId ===
          "ticket_add_user_modal"
        ) {
          const userId =
            interaction.fields
              .getTextInputValue(
                "user_id"
              )
              .trim();

          const member =
            await interaction.guild.members
              .fetch(
                userId
              )
              .catch(
                () => null
              );

          if (!member) {
            return interaction.reply({
              content:
                "❌ המשתמש לא נמצא.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          await interaction.channel
            .permissionOverwrites
            .edit(
              member.id,
              {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
              }
            );

          return interaction.reply({
            content:
              `✅ ${member} נוסף לטיקט.`,
            flags:
              MessageFlags.Ephemeral
          });
        }

        if (
          interaction.customId ===
          "ticket_remove_user_modal"
        ) {
          const userId =
            interaction.fields
              .getTextInputValue(
                "user_id"
              )
              .trim();

          const data =
            parseTicketTopic(
              interaction.channel
            );

          if (
            userId ===
            data.owner
          ) {
            return interaction.reply({
              content:
                "❌ אי אפשר להסיר את פותח הטיקט.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          await interaction.channel
            .permissionOverwrites
            .delete(
              userId
            )
            .catch(
              () => {}
            );

          return interaction.reply({
            content:
              `✅ <@${userId}> הוסר מהטיקט.`,
            flags:
              MessageFlags.Ephemeral
          });
        }

        if (
          interaction.customId ===
          "ticket_close_modal"
        ) {
          const reason =
            interaction.fields
              .getTextInputValue(
                "reason"
              );

          const channel =
            interaction.channel;

          const data =
            parseTicketTopic(
              channel
            );

          await interaction.reply({
            content:
              "🔒 סוגר את הטיקט ושומר Transcript...",
            flags:
              MessageFlags.Ephemeral
          });

          const transcript =
            await createTranscript(
              channel
            ).catch(
              () => null
            );

          const logs =
            config.ticketLogsChannelId
              ? interaction.guild.channels.cache.get(
                  config.ticketLogsChannelId
                )
              : null;

          if (
            logs &&
            logs.isTextBased()
          ) {
            const files = [];

            if (transcript) {
              files.push(
                new AttachmentBuilder(
                  transcript,
                  {
                    name:
                      `${channel.name}-transcript.txt`
                  }
                )
              );
            }

            await logs.send({
              embeds: [
                new EmbedBuilder()
                  .setColor("Red")
                  .setTitle(
                    "🔒 Ticket Closed"
                  )
                  .addFields(
                    {
                      name:
                        "פותח הטיקט",
                      value:
                        data.owner
                          ? `<@${data.owner}>`
                          : "לא ידוע",
                      inline: true
                    },
                    {
                      name:
                        "נסגר על ידי",
                      value:
                        `${interaction.user}`,
                      inline: true
                    },
                    {
                      name:
                        "סיבה",
                      value:
                        reason
                    }
                  )
                  .setTimestamp()
              ],
              files
            }).catch(
              () => {}
            );
          }

          delete ticketData
            .tickets[
              channel.id
            ];

          saveTickets();

          setTimeout(
            () => {
              channel.delete(
                `Closed by ${interaction.user.tag}`
              ).catch(
                () => {}
              );
            },
            2000
          );

          return;
        }
      }
    } catch (error) {
      console.error(
        "❌ Interaction error:",
        error
      );

      if (
        interaction.isRepliable()
      ) {
        const payload = {
          content:
            "❌ קרתה שגיאה. בדוק את הלוגים.",
          flags:
            MessageFlags.Ephemeral
        };

        if (
          interaction.replied ||
          interaction.deferred
        ) {
          await interaction
            .followUp(
              payload
            )
            .catch(
              () => {}
            );
        } else {
          await interaction
            .reply(
              payload
            )
            .catch(
              () => {}
            );
        }
      }
    }
  }
);

// =====================
// ERRORS + LOGIN
// =====================

client.on(
  "error",
  error => {
    console.error(
      "❌ Discord error:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "❌ Unhandled rejection:",
      error
    );
  }
);

async function loginWithRetry() {
  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      console.log(
        `🔌 Discord login attempt ${attempt}...`
      );

      await client.login(
        process.env.TOKEN
      );

      return;
    } catch (error) {
      console.error(
        "❌ Login error:",
        error
      );

      const delay =
        Math.min(
          60000,
          attempt * 10000
        );

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            delay
          )
      );
    }
  }
}

loginWithRetry();
