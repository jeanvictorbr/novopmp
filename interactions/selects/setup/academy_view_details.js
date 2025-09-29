const { EmbedBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'academy_view_details',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const courseId = interaction.values[0];
      const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);

      if (!course) {
        return await interaction.editReply('❌ Curso não encontrado.');
      }

      const role = interaction.guild.roles.cache.get(course.role_id);
      const roleMention = role ? role.toString() : '`Cargo não encontrado`';

      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`Detalhes do Curso: ${course.name}`)
        .addFields(
          { name: 'ID do Curso', value: `\`${course.course_id}\``, inline: true },
          { name: 'Horas Mínimas', value: `\`${course.required_hours}\`h`, inline: true },
          { name: 'Cargo Vinculado', value: roleMention, inline: false },
          { name: 'Descrição', value: course.description, inline: false }
        )
        .setFooter({ text: `Gerenciado pelo sistema Phoenix` });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error("Erro ao visualizar detalhes do curso:", error);
      await interaction.editReply('❌ Ocorreu um erro ao buscar os detalhes do curso.');
    }
  },
};