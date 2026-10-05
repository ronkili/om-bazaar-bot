require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const config = require("./config");

const commands = [
  new SlashCommandBuilder()
    .setName(
      "ticket-panel"
    )
    .setDescription(
      "שולח את פאנל הטיקטים"
    ),

  new SlashCommandBuilder()
    .setName(
      "setup-verify"
    )
    .setDescription(
      "מגדיר Verify וחדרי Members אוטומטית"
    ),

  new SlashCommandBuilder()
    .setName(
      "verify-panel"
    )
    .setDescription(
      "שולח את פאנל ה־Verify"
    ),

  new SlashCommandBuilder()
    .setName(
      "timeout"
    )
    .setDescription(
      "Timeout — הנהלה בלבד"
    )
    .addUserOption(
      option =>
        option
          .setName(
            "user"
          )
          .setDescription(
            "המשתמש"
          )
          .setRequired(
            true
          )
    )
    .addStringOption(
      option =>
        option
          .setName(
            "duration"
          )
          .setDescription(
            "משך הזמן"
          )
          .setRequired(
            true
          )
          .addChoices(
            {
              name:
                "10 דקות",
              value: "10m"
            },
            {
              name:
                "30 דקות",
              value: "30m"
            },
            {
              name:
                "שעה",
              value: "1h"
            },
            {
              name:
                "6 שעות",
              value: "6h"
            },
            {
              name:
                "12 שעות",
              value: "12h"
            },
            {
              name:
                "יום",
              value: "1d"
            },
            {
              name:
                "3 ימים",
              value: "3d"
            },
            {
              name:
                "7 ימים",
              value: "7d"
            }
          )
    )
    .addStringOption(
      option =>
        option
          .setName(
            "reason"
          )
          .setDescription(
            "סיבה"
          )
          .setRequired(
            false
          )
    ),

  new SlashCommandBuilder()
    .setName(
      "untimeout"
    )
    .setDescription(
      "מסיר Timeout — הנהלה בלבד"
    )
    .addUserOption(
      option =>
        option
          .setName(
            "user"
          )
          .setDescription(
            "המשתמש"
          )
          .setRequired(
            true
          )
    ),

  new SlashCommandBuilder()
    .setName(
      "clear"
    )
    .setDescription(
      "מוחק הודעות — הנהלה בלבד"
    )
    .addIntegerOption(
      option =>
        option
          .setName(
            "amount"
          )
          .setDescription(
            "כמות הודעות למחיקה"
          )
          .setRequired(
            true
          )
          .setMinValue(
            1
          )
          .setMaxValue(
            100
          )
    )
].map(
  command =>
    command.toJSON()
);

const rest =
  new REST({
    version: "10"
  }).setToken(
    process.env.TOKEN
  );

(async () => {
  try {
    console.log(
      "🔄 Deploying commands..."
    );

    await rest.put(
      Routes.applicationGuildCommands(
        config.clientId,
        config.guildId
      ),
      {
        body:
          commands
      }
    );

    console.log(
      "✅ Commands deployed."
    );
  } catch (error) {
    console.error(
      "❌ Deploy error:",
      error
    );

    process.exitCode = 1;
  }
})();
