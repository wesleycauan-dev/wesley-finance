import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <div className="auth">
      <article className="legal">
        <Link to="/entrar">Voltar</Link>
        <h1>Política de Privacidade</h1>
        <p className="muted small">
          Rascunho técnico. Antes de operar com clientes, revise este texto com
          um advogado e preencha os dados do controlador (nome, CNPJ/CPF, e-mail
          do encarregado).
        </p>
        <h2>Quais dados coletamos</h2>
        <p>
          Nome, e-mail, senha (armazenada apenas como hash), os lançamentos,
          categorias e metas que você cadastra, histórico de pagamentos (valor,
          status e datas) e registros técnicos de segurança (IP e navegador de
          login).
        </p>
        <h2>Para que usamos</h2>
        <p>
          Prestar o serviço contratado, autenticar sua conta, processar a
          assinatura e proteger a plataforma contra fraudes. Não vendemos seus
          dados.
        </p>
        <h2>Pagamentos</h2>
        <p>
          O pagamento é feito no ambiente do Mercado Pago. Não recebemos nem
          armazenamos dados do seu cartão.
        </p>
        <h2>Seus direitos (LGPD, art. 18)</h2>
        <p>
          Você pode solicitar acesso, correção, portabilidade e eliminação dos
          seus dados, e revogar o consentimento, pelo e-mail do encarregado.
        </p>
      </article>
    </div>
  );
}
