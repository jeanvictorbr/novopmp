const { RoleSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: (customId) => customId.startsWith('promote_select_'),
    async execute(interaction) {
        const parts = interaction.customId.split('_');
        const step = parts[2];
        
        // --- INÍCIO DA MODIFICAÇÃO (ETAPA DE SELEÇÃO DE CARGO) ---
        if (step === 'user') {
            const userId = interaction.values[0];
            const member = await interaction.guild.members.fetch(userId);

            // 1. Buscar todos os cargos que fazem parte da carreira
            const allCareerRoles = await db.all('SELECT role_id, previous_role_id FROM rank_requirements');
            const allCareerRoleIds = new Set([...allCareerRoles.map(r => r.role_id), ...allCareerRoles.map(r => r.previous_role_id).filter(Boolean)]);

            // 2. Encontrar o cargo mais alto que o membro possui atualmente
            const memberHighestRole = member.roles.cache
                .filter(role => allCareerRoleIds.has(role.id))
                .sort((a, b) => b.position - a.position)
                .first();

            // 3. Filtrar os cargos do servidor para mostrar apenas opções de promoção válidas
            const promotableRoles = interaction.guild.roles.cache
                .filter(role => 
                    allCareerRoleIds.has(role.id) && // O cargo deve fazer parte da carreira
                    (!memberHighestRole || role.position > memberHighestRole.position) // O cargo deve ser superior ao atual
                )
                .sort((a, b) => b.position - a.position);
            
            if (promotableRoles.size === 0) {
                return await interaction.update({ content: '❌ Este oficial já está no cargo mais alto da carreira ou não há promoções configuradas para ele.', components: [] });
            }

            // 4. Encontrar a sugestão do próximo cargo
            let placeholder = 'Selecione o NOVO cargo do oficial...';
            if (memberHighestRole) {
                const nextRank = allCareerRoles.find(r => r.previous_role_id === memberHighestRole.id);
                if (nextRank) {
                    const nextRoleObject = await interaction.guild.roles.fetch(nextRank.role_id).catch(() => null);
                    if (nextRoleObject) {
                        placeholder = `Sugestão: Promover para ${nextRoleObject.name}`;
                    }
                }
            }

            const menu = new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId(`promote_select_newrole_${userId}`)
                    .setPlaceholder(placeholder)
                    .setRoles(promotableRoles.map(role => role.id))
            );
            await interaction.update({ content: '**Etapa 2 de 3:** Selecione o novo cargo. A lista mostra apenas as promoções válidas.', components: [menu] });
        }
        // --- FIM DA MODIFICAÇÃO ---
        
        // Etapa 3: Novo cargo foi selecionado. Pede a justificativa (lógica inalterada).
        if (step === 'newrole') {
            const userId = parts[3];
            const newRoleId = interaction.values[0];
            
            const modal = new ModalBuilder()
                .setCustomId(`promote_modal_${userId}_${newRoleId}`)
                .setTitle('Justificativa da Promoção');
                
            const reasonInput = new TextInputBuilder()
                .setCustomId('promotion_reason')
                .setLabel("Motivo da Promoção")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Descreva os méritos e a razão pela qual o oficial está sendo promovido.")
                .setRequired(true);
                
            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal);
        }
    }
};