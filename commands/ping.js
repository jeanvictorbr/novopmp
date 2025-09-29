const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  // 'data' contém a definição do comando para registro na API do Discord
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Verifica a latência do bot e responde com Pong!'),

  // 'execute' contém a lógica que será executada quando o comando for usado
  async execute(interaction) {
    const latency = interaction.client.ws.ping;
    await interaction.reply({ content: `Pong! 🏓\nLatência da API: \`${latency}ms\``, ephemeral: true });
  },
};