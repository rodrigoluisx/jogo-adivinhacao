import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./src/firebase";

const COLORS = {
  fundo: "#F4F6FB",
  card: "#FFFFFF",
  primaria: "#4F46E5",
  texto: "#1F2937",
  suave: "#6B7280",
  borda: "#D1D5DB",
  verde: "#16A34A",
  verdeFundo: "#DCFCE7",
  vermelho: "#DC2626",
  vermelhoFundo: "#FEE2E2",
  ouro: "#F59E0B",
};

/* ------------------------------------------------------------------ */
/* Componentes reutilizáveis                                          */
/* ------------------------------------------------------------------ */

function Botao({ titulo, onPress, desabilitado, secundario }) {
  return (
    <TouchableOpacity
      style={[
        styles.botao,
        secundario && styles.botaoSecundario,
        desabilitado && styles.botaoDesabilitado,
      ]}
      onPress={onPress}
      disabled={desabilitado}
      activeOpacity={0.8}
    >
      <Text style={[styles.botaoTexto, secundario && styles.botaoTextoSecundario]}>
        {titulo}
      </Text>
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------------ */
/* Tela 1 - Início                                                    */
/* ------------------------------------------------------------------ */

function TelaInicio({ onComecar, onRanking }) {
  const [nickname, setNickname] = useState("");
  const nome = nickname.trim();

  return (
    <KeyboardAvoidingView
      style={styles.centro}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.emoji}>🎯</Text>
      <Text style={styles.titulo}>Jogo de Adivinhação</Text>
      <Text style={styles.subtitulo}>
        Descubra o número secreto entre 1 e 100 com o menor número de tentativas.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Seu nickname</Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder="Ex.: Jogador1"
          placeholderTextColor={COLORS.suave}
          maxLength={20}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => nome && onComecar(nome)}
        />
        <Botao titulo="Começar" desabilitado={!nome} onPress={() => onComecar(nome)} />
        <Botao titulo="🏆 Ver ranking" secundario onPress={onRanking} />
      </View>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ */
/* Tela 2 - Jogo                                                      */
/* ------------------------------------------------------------------ */

function TelaJogo({ nickname, onVitoria, onSair }) {
  // O número é sorteado uma única vez, quando a tela é montada
  const numeroSorteado = useRef(Math.floor(Math.random() * 100) + 1).current;

  const [palpite, setPalpite] = useState("");
  const [tentativas, setTentativas] = useState(0);
  const [historico, setHistorico] = useState([]);
  const [erro, setErro] = useState("");

  const ultimaDica = historico[0];

  function chutar() {
    const valor = Number(palpite);

    if (!palpite.trim() || !Number.isInteger(valor) || valor < 1 || valor > 100) {
      setErro("Digite um número inteiro entre 1 e 100.");
      return;
    }
    setErro("");

    const total = tentativas + 1;
    setTentativas(total);
    setPalpite("");

    if (valor === numeroSorteado) {
      onVitoria({ numero: numeroSorteado, tentativas: total });
      return;
    }

    const maior = numeroSorteado > valor;
    setHistorico((h) => [
      {
        id: String(total),
        palpite: valor,
        maior,
        texto: maior
          ? `O número é MAIOR que ${valor} ⬆️`
          : `O número é MENOR que ${valor} ⬇️`,
      },
      ...h,
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topoJogo}>
        <Text style={styles.jogador}>👤 {nickname}</Text>
        <View style={styles.contador}>
          <Text style={styles.contadorNumero}>{tentativas}</Text>
          <Text style={styles.contadorLabel}>tentativas</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Qual é o número? (1 a 100)</Text>
        <TextInput
          style={[styles.input, styles.inputGrande]}
          value={palpite}
          onChangeText={(t) => setPalpite(t.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          maxLength={3}
          placeholder="?"
          placeholderTextColor={COLORS.suave}
          onSubmitEditing={chutar}
        />
        {!!erro && <Text style={styles.erro}>{erro}</Text>}
        <Botao titulo="Chutar" onPress={chutar} />
      </View>

      {ultimaDica ? (
        <View
          style={[
            styles.dicaDestaque,
            { backgroundColor: ultimaDica.maior ? COLORS.verdeFundo : COLORS.vermelhoFundo },
          ]}
        >
          <Text
            style={[
              styles.dicaDestaqueTexto,
              { color: ultimaDica.maior ? COLORS.verde : COLORS.vermelho },
            ]}
          >
            {ultimaDica.texto}
          </Text>
        </View>
      ) : (
        <Text style={styles.vazio}>Faça seu primeiro palpite!</Text>
      )}

      <FlatList
        data={historico.slice(1)}
        keyExtractor={(item) => item.id}
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: 16 }}
        renderItem={({ item }) => (
          <View style={styles.linhaHistorico}>
            <Text style={styles.historicoNumero}>#{item.id}</Text>
            <Text
              style={[
                styles.historicoTexto,
                { color: item.maior ? COLORS.verde : COLORS.vermelho },
              ]}
            >
              {item.texto}
            </Text>
          </View>
        )}
      />

      <Botao titulo="Desistir" secundario onPress={onSair} />
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ */
/* Tela 3 - Vitória (também salva o resultado no Firebase)            */
/* ------------------------------------------------------------------ */

function TelaVitoria({ nickname, resultado, onJogarNovamente, onRanking }) {
  const [status, setStatus] = useState("salvando"); // salvando | salvo | erro
  const salvou = useRef(false);

  const salvar = useCallback(async () => {
    setStatus("salvando");
    try {
      await addDoc(collection(db, "ranking"), {
        nickname,
        tentativas: resultado.tentativas,
        criadoEm: serverTimestamp(),
      });
      setStatus("salvo");
    } catch (e) {
      console.warn("Erro ao salvar no Firebase:", e);
      setStatus("erro");
    }
  }, [nickname, resultado.tentativas]);

  useEffect(() => {
    if (salvou.current) return; // evita salvar duas vezes
    salvou.current = true;
    salvar();
  }, [salvar]);

  return (
    <View style={styles.centro}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.titulo}>Você acertou, {nickname}!</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Número sorteado</Text>
        <Text style={styles.numeroGigante}>{resultado.numero}</Text>
        <Text style={styles.label}>Total de tentativas</Text>
        <Text style={[styles.numeroGigante, { color: COLORS.verde }]}>
          {resultado.tentativas}
        </Text>

        {status === "salvando" && (
          <View style={styles.linhaStatus}>
            <ActivityIndicator color={COLORS.primaria} />
            <Text style={styles.statusTexto}> Salvando no ranking...</Text>
          </View>
        )}
        {status === "salvo" && (
          <Text style={[styles.statusTexto, { color: COLORS.verde }]}>
            ✅ Resultado salvo no ranking!
          </Text>
        )}
        {status === "erro" && (
          <View>
            <Text style={[styles.statusTexto, { color: COLORS.vermelho }]}>
              ❌ Não foi possível salvar o resultado.
            </Text>
            <Botao titulo="Tentar salvar novamente" secundario onPress={salvar} />
          </View>
        )}
      </View>

      <Botao titulo="Jogar novamente" onPress={onJogarNovamente} />
      <Botao titulo="🏆 Ver ranking" secundario onPress={onRanking} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Tela 4 - Ranking                                                   */
/* ------------------------------------------------------------------ */

function TelaRanking({ onVoltar }) {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    try {
      const q = query(collection(db, "ranking"), orderBy("tentativas", "asc"), limit(50));
      const snap = await getDocs(q);
      const dados = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Desempate: quem chegou primeiro fica à frente
      dados.sort((a, b) => {
        if (a.tentativas !== b.tentativas) return a.tentativas - b.tentativas;
        const ta = a.criadoEm?.toMillis?.() ?? 0;
        const tb = b.criadoEm?.toMillis?.() ?? 0;
        return ta - tb;
      });
      setLista(dados);
    } catch (e) {
      console.warn("Erro ao carregar ranking:", e);
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const medalha = (i) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`);

  return (
    <View style={styles.flex}>
      <Text style={[styles.titulo, { marginBottom: 12 }]}>🏆 Ranking</Text>
      <Text style={[styles.subtitulo, { marginBottom: 12 }]}>
        Menos tentativas = melhor posição
      </Text>

      {carregando ? (
        <ActivityIndicator size="large" color={COLORS.primaria} style={{ marginTop: 40 }} />
      ) : erro ? (
        <View style={styles.centro}>
          <Text style={[styles.statusTexto, { color: COLORS.vermelho }]}>
            Não foi possível carregar o ranking.
          </Text>
          <Botao titulo="Tentar novamente" onPress={carregar} />
        </View>
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(item) => item.id}
          style={styles.flex}
          ListEmptyComponent={
            <Text style={styles.vazio}>Nenhum resultado ainda. Seja o primeiro!</Text>
          }
          renderItem={({ item, index }) => (
            <View style={[styles.linhaRanking, index < 3 && styles.linhaRankingTop]}>
              <Text style={styles.posicao}>{medalha(index)}</Text>
              <Text style={styles.rankingNome} numberOfLines={1}>
                {item.nickname}
              </Text>
              <Text style={styles.rankingTentativas}>{item.tentativas}</Text>
            </View>
          )}
        />
      )}

      <Botao titulo="Atualizar" secundario onPress={carregar} desabilitado={carregando} />
      <Botao titulo="Voltar" onPress={onVoltar} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* App - controla qual tela está visível                              */
/* ------------------------------------------------------------------ */

export default function App() {
  const [tela, setTela] = useState("inicio"); // inicio | jogo | vitoria | ranking
  const [nickname, setNickname] = useState("");
  const [resultado, setResultado] = useState(null);
  const [partida, setPartida] = useState(0); // muda a cada partida para reiniciar a TelaJogo

  function comecar(nome) {
    setNickname(nome);
    setPartida((p) => p + 1);
    setTela("jogo");
  }

  function venceu(res) {
    setResultado(res);
    setTela("vitoria");
  }

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" />

      {tela === "inicio" && (
        <TelaInicio onComecar={comecar} onRanking={() => setTela("ranking")} />
      )}
      {tela === "jogo" && (
        <TelaJogo
          key={partida}
          nickname={nickname}
          onVitoria={venceu}
          onSair={() => setTela("inicio")}
        />
      )}
      {tela === "vitoria" && (
        <TelaVitoria
          key={partida}
          nickname={nickname}
          resultado={resultado}
          onJogarNovamente={() => comecar(nickname)}
          onRanking={() => setTela("ranking")}
        />
      )}
      {tela === "ranking" && <TelaRanking onVoltar={() => setTela("inicio")} />}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Estilos                                                            */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.fundo,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 12 : 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  flex: { flex: 1 },
  centro: { flex: 1, justifyContent: "center" },

  emoji: { fontSize: 56, textAlign: "center", marginBottom: 8 },
  titulo: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.texto,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitulo: {
    fontSize: 15,
    color: COLORS.suave,
    textAlign: "center",
    marginBottom: 24,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  label: { fontSize: 14, color: COLORS.suave, marginBottom: 6, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: COLORS.borda,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: COLORS.texto,
    backgroundColor: "#FAFAFA",
    marginBottom: 12,
    textAlign: "center",
  },
  inputGrande: { fontSize: 32, fontWeight: "700" },
  erro: { color: COLORS.vermelho, textAlign: "center", marginBottom: 10 },

  botao: {
    backgroundColor: COLORS.primaria,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  botaoSecundario: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: COLORS.primaria,
  },
  botaoDesabilitado: { opacity: 0.4 },
  botaoTexto: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  botaoTextoSecundario: { color: COLORS.primaria },

  topoJogo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  jogador: { fontSize: 18, fontWeight: "700", color: COLORS.texto },
  contador: {
    backgroundColor: COLORS.primaria,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: "center",
  },
  contadorNumero: { color: "#FFF", fontSize: 22, fontWeight: "800" },
  contadorLabel: { color: "#E0E7FF", fontSize: 11 },

  dicaDestaque: { borderRadius: 14, padding: 16, marginBottom: 12 },
  dicaDestaqueTexto: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  vazio: { textAlign: "center", color: COLORS.suave, marginVertical: 16 },

  linhaHistorico: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borda,
  },
  historicoNumero: { width: 40, color: COLORS.suave, fontWeight: "600" },
  historicoTexto: { fontSize: 15, fontWeight: "600" },

  numeroGigante: {
    fontSize: 56,
    fontWeight: "900",
    color: COLORS.primaria,
    textAlign: "center",
    marginBottom: 12,
  },
  linhaStatus: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  statusTexto: { textAlign: "center", fontSize: 15, marginTop: 4 },

  linhaRanking: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  linhaRankingTop: { borderWidth: 1.5, borderColor: COLORS.ouro },
  posicao: { width: 44, fontSize: 18, fontWeight: "700", color: COLORS.texto },
  rankingNome: { flex: 1, fontSize: 16, color: COLORS.texto },
  rankingTentativas: { fontSize: 18, fontWeight: "800", color: COLORS.primaria },
});
