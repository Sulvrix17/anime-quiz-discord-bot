require("dotenv").config(); // Load environment variables
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
} = require("discord.js");
const fs = require("fs"); // Import the fs module to read files
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Required to read message content
    ],
});

const token = process.env.BOT_TOKEN; // Load token from .env file

// Load questions from questions.json
const questions = JSON.parse(fs.readFileSync("questions.json", "utf-8"));

let currentQuestion = null;
let lastQuestion = null; // Track the last question asked
const scores = new Map();
const answeredUsers = new Set(); // Track users who have answered

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
    postDailyQuestion(); // Post the first question immediately
});

function getRandomQuestion() {
    let randomQuestion;
    do {
        // Select a random question
        randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    } while (randomQuestion === lastQuestion); // Ensure it's not the same as the last question

    lastQuestion = randomQuestion; // Update the last question asked
    return randomQuestion;
}

function postDailyQuestion() {
    const randomQuestion = getRandomQuestion(); // Get a non-repeating random question
    currentQuestion = randomQuestion;
    answeredUsers.clear(); // Reset answered users for the new question

    // Create an embed with RTL text and image
    const embed = new EmbedBuilder()
        .setTitle("\u200F🎌 سؤال الأنمي اليومي 🎌") // RTL mark + reversed text
        .setDescription("\u200F" + randomQuestion.question) // RTL mark
        .setColor("#FFD700") // Gold color
        .setThumbnail("https://i.imgur.com/56Bu3l9.png") // Updated image URL
        .setImage(randomQuestion.image) // Add the question image
        .addFields(
            { name: "\u200B", value: "\u200B", inline: false }, // Invisible spacer field
        )
        .addFields(
            {
                name: "\u200Fالوقت المتبقي",
                value: "\u200F⏳ 30 ثانية",
                inline: false,
            }, // RTL mark + reversed text
            {
                name: "\u200Fالنقاط",
                value: "\u200F!اكتب الإجابة الصحيحة في الشات",
                inline: false,
            }, // RTL mark + reversed text
        )
        .addFields(
            { name: "\u200B", value: "\u200B", inline: false }, // Invisible spacer field
        )
        .setFooter({
            text: "\u200Fأنمي كويز بوت",
            iconURL: "https://i.imgur.com/56Bu3l9.png",
        }) // Updated image URL
        .setTimestamp(); // Add a timestamp

    // Send the embed
    client.channels.cache
        .get("1343357167528448081")
        .send({ embeds: [embed] });

    // Set a 30-second timer to end the answering window
    setTimeout(() => {
        if (currentQuestion) {
            const answerEmbed = new EmbedBuilder()
                .setTitle("\u200F⏰ انتهى الوقت ⏰") // RTL mark + reversed text
                .setDescription(
                    "\u200F" +
                    `الإجابة الصحيحة هي: **${currentQuestion.correctAnswer}**`,
                ) // RTL mark
                .setColor("#FF0000") // Red color
                .setFooter({
                    text: "\u200Fأنمي كويز بوت",
                    iconURL: "https://i.imgur.com/56Bu3l9.png",
                }) // Updated image URL
                .setTimestamp();
            client.channels.cache
                .get("1343357167528448081")
                .send({ embeds: [answerEmbed] });
            currentQuestion = null; // Reset the question

            // Schedule the next question after 30 seconds
            setTimeout(postDailyQuestion, 30000); // 30 seconds
        }
    }, 30000); // 30 seconds
}

// Listen for messages in the chat
client.on("messageCreate", async (message) => {
    if (message.author.bot) return; // Ignore messages from bots
    if (!currentQuestion) return; // Ignore messages if no question is active

    // Check if the user has already answered
    if (answeredUsers.has(message.author.id)) {
        try {
            await message.reply("لقد أجبت بالفعل على هذا السؤال!");
        } catch (error) {
            console.error("Failed to send reply:", error);
        }
        return;
    }

    // Check if the message matches the correct answer
    if (message.content.trim().toLowerCase() === currentQuestion.correctAnswer.toLowerCase()) {
        // Add the user to the answered users set
        answeredUsers.add(message.author.id);

        // Update the user's score
        const userScore = scores.get(message.author.id) || 0;
        scores.set(message.author.id, userScore + 1);

        try {
            // Announce the correct answer
            await message.channel.send(`<@${message.author.id}> أجاب بشكل صحيح! 🎉`);
        } catch (error) {
            console.error("Failed to send announcement:", error);
        }

        // Reset the question
        currentQuestion = null;

        // Schedule the next question after 30 seconds
        setTimeout(postDailyQuestion, 30000); // 30 seconds
    }
});

// Leaderboard command
client.on("messageCreate", (message) => {
    if (message.content === "!الترتيب") {
        const sortedScores = [...scores.entries()].sort((a, b) => b[1] - a[1]);
        const leaderboard = sortedScores
            .map(
                ([userId, score], index) =>
                    `**${index + 1}.** <@${userId}>: ${score} نقاط`,
            )
            .join("\n");

        const embed = new EmbedBuilder()
            .setTitle("🏆 لوحة المتصدرين 🏆")
            .setDescription(leaderboard || "لا توجد نقاط حتى الآن!")
            .setColor("#00FF00") // Green color
            .setFooter({
                text: "أنمي كويز بوت",
                iconURL: "https://i.imgur.com/56Bu3l9.png",
            }) // Updated image URL
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }
});

// Help command
client.on("messageCreate", (message) => {
    if (message.content === "!مساعدة") {
        const embed = new EmbedBuilder()
            .setTitle("🛠️ مساعدة أنمي كويز بوت 🛠️")
            .setDescription(
                `
                **كيفية استخدام البوت:**
                - سيتم نشر سؤال أنمي كل 30 ثانية بعد انتهاء السؤال السابق.
                - اكتب الإجابة الصحيحة في الشات.
                - لديك 30 ثانية للإجابة على كل سؤال.
                - استخدم \`!الترتيب\` لرؤية أفضل اللاعبين.
            `,
            )
            .setColor("#00BFFF") // Blue color
            .setFooter({
                text: "أنمي كويز بوت",
                iconURL: "https://i.imgur.com/56Bu3l9.png",
            }) // Updated image URL
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }
});

// Admin command to force a question (using multiple role IDs)
client.on("messageCreate", async (message) => {
    if (message.content === "!سؤال") {
        // Replace with your allowed role IDs
        const allowedRoleIds = ["1322237538232172568", "1342591205455954012"]; // Example: ['123456789012345678', '987654321098765432']
        const hasAllowedRole = allowedRoleIds.some((roleId) =>
            message.member.roles.cache.has(roleId),
        );

        if (hasAllowedRole) {
            // Force post a question
            postDailyQuestion();
        }
    }
});

client.login(token);