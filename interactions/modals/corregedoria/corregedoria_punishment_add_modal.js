const { EmbedBuilder } = require('discord.js');
const db = require('../../../database/db.js');
const { getCorregedoriaPunishmentsMenuPayload } = require('../../../views/setup_views.js');
const { parseDuration } = require('../../../utils/timeUtils.js');

module.exports = {
    customId: 'corregedoria_punishment_add_modal',
    async execute(interaction) {
        // Responde à interação do modal de forma efêmera (só você vê)
        await interaction.deferReply({ ephemeral: true });

        try {
            const name = interaction.fields.getTextInputValue('punishment_name');
            const description = interaction.fields.getTextInputValue('punishment_description');
            const durationStr = interaction.fields.getTextInputValue('punishment_duration');

            const durationSeconds = parseDuration(durationStr);
            if (durationSeconds === null) {
                return await interaction.editReply({ content: '❌ Formato de duração inválido. Use (m)inutos, (h)oras ou (d)ias (ex: `30m`, `12h`, `7d`). Se a punição for permanente, deixe em branco.'});
            }

            const newRole = await interaction.guild.roles.create({
                name: `Punição: ${name}`,
                color: 'DarkRed',
                reason: `Cargo de punição criado automaticamente pelo sistema de Corregedoria.`
            });

            await db.run(
                'INSERT INTO corregedoria_punishments (name, description, role_id, duration_seconds) VALUES ($1, $2, $3, $4)',
                [name, description, newRole.id, durationSeconds]
            );

            // CORREÇÃO: A linha que tentava editar a mensagem original foi removida.
            // Agora, apenas enviamos uma confirmação para a interação atual.
            await interaction.editReply({ 
                content: `✅ Punição **"${name}"** e cargo associado ${newRole.toString()} criados com sucesso. Clique em "Voltar" no painel para ver a lista atualizada.`
            });

        } catch (error) {
            console.error("Erro ao adicionar punição:", error);
            if(error.code === '23505') { 
                await interaction.editReply({ content: `❌ A punição com o nome "${name}" já existe.`});
            } else {
                await interaction.editReply({ content: '❌ Ocorreu um erro ao adicionar a punição. Verifique as permissões do bot.'});
            }
        }
    }
};