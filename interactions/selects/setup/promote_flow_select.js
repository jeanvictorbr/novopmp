const { StringSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: (customId) => customId.startsWith('promote_select_'),
    async execute(interaction) {
        // Assegura que a interação não falhe por tempo
        await interaction.deferUpdate();

        const parts = interaction.customId.split('_');
        const step = parts[2];
        
        if (step === 'user') {
            const userId = interaction.values[0];
            const member = await interaction.guild.members.fetch(userId);

            const allCareerRoles = await db.all('SELECT role_id, previous_role_id FROM rank_requirements');
            const allCareerRoleIds = new Set([...allCareerRoles.map(r => r.role_id), ...allCareerRoles.map(r => r.previous_role_id).filter(Boolean)]);

            const memberHighestRole = member.roles.cache
                .filter(role => allCareerRoleIds.has(role.id))
                .sort((a, b) => b.position - a.position)
                .first();

            // --- INÍCIO DA NOVA LÓGICA DE FILTRAGEM ---
            const promotableRoleIds = [];
            if (!memberHighestRole) {
                // Se o membro não tem cargo de carreira, mostra todos os cargos de carreira como opção
                interaction.guild.roles.cache
                    .filter(role => allCareerRoleIds.has(role.id))
                    .sort((a, b) => a.position - b.position)
                    .forEach(role => promotableRoleIds.push(role.id));
            } else {
                // Se ele tem um cargo, percorre a cadeia de promoções a partir do cargo atual
                let currentIdInChain = memberHighestRole.id;
                const visited = new Set(); 

                while (currentIdInChain && !visited.has(currentIdInChain)) {
                    visited.add(currentIdInChain);
                    const nextStep = allCareerRoles.find(r => r.previous_role_id === currentIdInChain);
                    
                    if (nextStep) {
                        promotableRoleIds.push(nextStep.role_id);
                        currentIdInChain = nextStep.role_id;
                    } else {
                        currentIdInChain = null;
                    }
                }
            }
            
            if (promotableRoleIds.length === 0) {
                return await interaction.editReply({ content: '❌ Este oficial já está no cargo mais alto da carreira ou não há promoções configuradas para ele.', components: [] });
            }

            const roleOptions = promotableRoleIds
                .map(id => interaction.guild.roles.cache.get(id))
                .filter(Boolean)
                .map(role => ({
                    label: role.name,
                    value: role.id,
                }));

            // Lógica para a sugestão (placeholder)
            let placeholder = 'Selecione o NOVO cargo do oficial...';
            if (roleOptions.length > 0) {
                placeholder = `Sugestão: Promover para ${roleOptions[0].label}`;
            }
            
            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`promote_select_newrole_${userId}`)
                    .setPlaceholder(placeholder)
                    .addOptions(roleOptions.slice(0, 25))
            );
            // --- FIM DA NOVA LÓGICA ---

            await interaction.editReply({ content: '**Etapa 2 de 3:** Selecione o novo cargo. A lista mostra apenas as promoções válidas.', components: [menu] });
        }
        
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