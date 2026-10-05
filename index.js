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
    GatewayIntentBits.MessageContent
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
    if (
      !message.guild ||
      message.author.bot
    ) {
      return;
    }

    const content =
      message.content.trim();

    if (
      content === "!h" ||
      content.startsWith(
        "!h "
      )
    ) {
      const reason =
        content.length > 2
          ? content
              .slice(2)
              .trim()
          : "";

      return sendHelpRequest(
        message,
        reason
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

        const embed =
          EmbedBuilder.from(
            original
          )
            .setColor("Green")
            .setDescription(
              [
                "### בקשת עזרה חדשה 🆘",
                "",
                `👤 **משתמש:** <@${requesterId}>`,
                "",
                "📌 **סטטוס:** ✅ בטיפול",
                `🛡️ **מטפל:** ${interaction.user}`
              ].join("\n")
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
