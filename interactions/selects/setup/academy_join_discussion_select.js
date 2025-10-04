module.exports = {
    customId: 'academy_join_discussion_select',
    async execute(interaction) {
        await interaction.deferUpdate();
        const threadId = interaction.values[0];

        try {
            const thread = await interaction.guild.channels.fetch(threadId);
            if (!thread) {
                return await interaction.followUp({ content: '❌ Tópico de discussão não encontrado.', ephemeral: true });
            }

            await thread.members.add(interaction.user.id, 'Acesso de administrador');
            
            // Mensagem mencionando o admin dentro do tópico
            await thread.send(`👋 Bem-vindo(a), ${interaction.user.toString()}! Você está visualizando esta discussão como administrador.`);

            // Confirmação para o admin
            await interaction.editReply({ content: `✅ Você foi adicionado(a) à discussão ${thread.toString()}. A turma foi notificada.`, components: [] });

        } catch (error) {
            console.error('Erro ao adicionar admin à discussão:', error);
            await interaction.followUp({ content: '❌ Ocorreu um erro ao tentar te adicionar à discussão.', ephemeral: true });
        }
    }
};